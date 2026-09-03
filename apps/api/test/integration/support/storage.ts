/**
 * Real-MinIO test harness (Sprint Enterprise 0, Lot 2 - docs/14-ROADMAP-SAAS-PREMIUM.md axe E2),
 * the S3-compatible counterpart to support/database.ts. `test/document-storage.service.spec.ts`
 * and `test/documents.service.spec.ts` mock the S3 client / storage service entirely - useful for
 * branch coverage, but unable to catch anything that depends on a real object store: whether bytes
 * actually round-trip unmodified, whether the integrity check in
 * DocumentsService#downloadVerified genuinely detects corrupted storage (not just a mismatched
 * mock return value), or whether the upload-then-DB-insert compensating delete on failure actually
 * removes the object. Starts a disposable `minio/minio` container via Testcontainers (the same
 * image docker-compose.yml pins for the `minio` service) and hands back the real
 * `DocumentStorageService` wired to it.
 */
import {
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { MinioContainer, StartedMinioContainer } from '@testcontainers/minio';
import { DocumentStorageService } from '../../../src/documents/document-storage.service';

// docker-compose.yml's `minio` service image - kept in sync manually (see support/database.ts's
// identical note for POSTGRES_IMAGE): if that pin changes, update this one too.
const MINIO_IMAGE = 'minio/minio:RELEASE.2025-09-07T16-13-09Z';
const TEST_BUCKET = 'fodip-test-documents';

export interface IntegrationStorage {
  /** The production `DocumentStorageService`, wired to the disposable container - use this to exercise DocumentsService unmodified. */
  storage: DocumentStorageService;
  /** Raw S3 client for assertions and fixture setup `DocumentStorageService` deliberately doesn't expose (corrupting stored bytes, listing every object). */
  client: S3Client;
  bucket: string;
  /** Deletes every object in the test bucket so the next test starts from an empty store. */
  reset(): Promise<void>;
  /** Stops the client and the container. Call once in `afterAll`. */
  stop(): Promise<void>;
}

export async function startIntegrationStorage(): Promise<IntegrationStorage> {
  // Same escape hatch as support/database.ts's TEST_DATABASE_URL, for the same reason: a sandbox
  // whose egress policy blocks Testcontainers' image pull but where a real S3-compatible endpoint
  // is reachable some other way (e.g. a locally-run s3rver instance) can still exercise the real
  // logic. CI and every contributor with a working Docker daemon should leave these unset.
  const externalEndpoint = process.env.TEST_STORAGE_ENDPOINT;
  const container: StartedMinioContainer | undefined = externalEndpoint
    ? undefined
    : await new MinioContainer(MINIO_IMAGE).withUsername('fodip_test').withPassword('fodip_test_secret').start();

  const endpoint = externalEndpoint ?? container!.getConnectionUrl();
  const accessKeyId = externalEndpoint ? (process.env.TEST_STORAGE_ACCESS_KEY ?? 'S3RVER') : container!.getUsername();
  const secretAccessKey = externalEndpoint ? (process.env.TEST_STORAGE_SECRET_KEY ?? 'S3RVER') : container!.getPassword();

  const config = new ConfigService({
    STORAGE_ENDPOINT: endpoint, STORAGE_ACCESS_KEY: accessKeyId, STORAGE_SECRET_KEY: secretAccessKey,
    STORAGE_BUCKET: TEST_BUCKET, STORAGE_REGION: 'us-east-1',
  });
  // Real DocumentStorageService, not a stand-in: constructed the same way Nest's DI would, so
  // integration specs run the exact bucket-provisioning and S3 request code production traffic
  // goes through (it lazily creates the bucket on first upload - see initializeBucket()).
  const storage = new DocumentStorageService(config);
  const client = new S3Client({ endpoint, region: 'us-east-1', forcePathStyle: true, credentials: { accessKeyId, secretAccessKey } });

  return {
    storage,
    client,
    bucket: TEST_BUCKET,
    async reset() {
      const listed = await client.send(new ListObjectsV2Command({ Bucket: TEST_BUCKET })).catch((error) => {
        // Bucket doesn't exist yet if no test has uploaded anything so far in this file - nothing to reset.
        if ((error as { name?: string }).name === 'NoSuchBucket') return { Contents: undefined };
        throw error;
      });
      const keys = listed.Contents?.map((object) => object.Key).filter((key): key is string => Boolean(key)) ?? [];
      await Promise.all(keys.map((key) => client.send(new DeleteObjectCommand({ Bucket: TEST_BUCKET, Key: key }))));
    },
    async stop() {
      client.destroy();
      await container?.stop();
    },
  };
}

/** Overwrites the bytes of an already-stored object in place - simulates storage-layer corruption to test DocumentsService#downloadVerified's integrity check. */
export async function corruptStoredObject(client: S3Client, bucket: string, key: string, corruptedBytes: Buffer): Promise<void> {
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: corruptedBytes }));
}
