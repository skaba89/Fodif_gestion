import { DefaultAzureCredential } from '@azure/identity';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface StoredDocument {
  buffer: Buffer;
  contentType: string;
}

@Injectable()
export class DocumentStorageService {
  private readonly container: ContainerClient | null;

  constructor(config: ConfigService) {
    const connectionString = config.get<string>('AZURE_STORAGE_CONNECTION_STRING');
    const account = config.get<string>('AZURE_STORAGE_ACCOUNT');
    const containerName = config.get<string>('AZURE_STORAGE_CONTAINER') ?? 'fodip-documents';

    let client: BlobServiceClient | null = null;
    if (connectionString) {
      client = BlobServiceClient.fromConnectionString(connectionString);
    } else if (account && account !== 'CHANGE_ME') {
      client = new BlobServiceClient(`https://${account}.blob.core.windows.net`, new DefaultAzureCredential());
    }
    this.container = client?.getContainerClient(containerName) ?? null;
  }

  async upload(key: string, buffer: Buffer, contentType: string, checksum: string): Promise<void> {
    const container = this.requireContainer();
    await container.createIfNotExists();
    await container.getBlockBlobClient(key).uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: contentType },
      metadata: { checksumSha256: checksum },
    });
  }

  async download(key: string): Promise<StoredDocument> {
    const response = await this.requireContainer().getBlobClient(key).download();
    if (!response.readableStreamBody) throw new ServiceUnavailableException('Document content is unavailable');
    const chunks: Buffer[] = [];
    for await (const chunk of response.readableStreamBody) chunks.push(Buffer.from(chunk));
    return {
      buffer: Buffer.concat(chunks),
      contentType: response.contentType ?? 'application/octet-stream',
    };
  }

  async delete(key: string): Promise<void> {
    await this.requireContainer().deleteBlob(key, { deleteSnapshots: 'include' });
  }

  private requireContainer(): ContainerClient {
    if (!this.container) {
      throw new ServiceUnavailableException('Azure document storage is not configured');
    }
    return this.container;
  }
}
