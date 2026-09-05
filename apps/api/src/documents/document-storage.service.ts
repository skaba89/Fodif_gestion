import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface StoredDocument {
  buffer: Buffer;
  contentType: string;
}

@Injectable()
export class DocumentStorageService {
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private bucketReady: Promise<void> | null = null;

  constructor(config: ConfigService) {
    const endpoint = config.get<string>('STORAGE_ENDPOINT');
    const accessKeyId = config.get<string>('STORAGE_ACCESS_KEY');
    const secretAccessKey = config.get<string>('STORAGE_SECRET_KEY');
    this.bucket = config.get<string>('STORAGE_BUCKET') ?? 'fodip-documents';
    this.client = endpoint && accessKeyId && secretAccessKey
      ? new S3Client({
          endpoint,
          region: config.get<string>('STORAGE_REGION') ?? 'us-east-1',
          forcePathStyle: true,
          credentials: { accessKeyId, secretAccessKey },
        })
      : null;
  }

  async upload(key: string, buffer: Buffer, contentType: string, checksum: string): Promise<void> {
    const client = this.requireClient();
    await this.ensureBucket();
    await client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: { checksumSha256: checksum },
    }));
  }

  async download(key: string): Promise<StoredDocument> {
    const response = await this.requireClient().send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!response.Body) throw new ServiceUnavailableException('Document content is unavailable');
    return {
      buffer: Buffer.from(await response.Body.transformToByteArray()),
      contentType: response.ContentType ?? 'application/octet-stream',
    };
  }

  async delete(key: string): Promise<void> {
    await this.requireClient().send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async ping(): Promise<boolean> {
    if (!this.client) return false;
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    return true;
  }

  private requireClient(): S3Client {
    if (!this.client) {
      throw new ServiceUnavailableException('S3-compatible document storage is not configured');
    }
    return this.client;
  }

  private ensureBucket(): Promise<void> {
    if (!this.bucketReady) this.bucketReady = this.initializeBucket();
    return this.bucketReady;
  }

  private async initializeBucket(): Promise<void> {
    const client = this.requireClient();
    try {
      await client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (error) {
      const statusCode = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (statusCode !== 404) {
        this.bucketReady = null;
        throw error;
      }
      try {
        await client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      } catch (error) {
        this.bucketReady = null;
        throw error;
      }
    }
  }
}
