import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth-user.interface';
import { canUploadDocument, isAllowedDocumentType, validateDocumentFile } from '../document-policy';
import { DocumentStorageService, StoredDocument } from './document-storage.service';
import { DocumentsRepository } from './documents.repository';

export interface DownloadedDocument extends StoredDocument {
  fileName: string;
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly documents: DocumentsRepository,
    private readonly storage: DocumentStorageService,
  ) {}

  async listOwn(user: AuthenticatedUser, dossierId: string) {
    return this.documents.listOwned(dossierId, this.enterpriseId(user));
  }

  async uploadOwn(user: AuthenticatedUser, dossierId: string, typeDocument: string, file?: Express.Multer.File) {
    const entrepriseId = this.enterpriseId(user);
    if (!isAllowedDocumentType(typeDocument)) throw new BadRequestException('Unsupported document type');
    if (!file) throw new BadRequestException('Document file is required');

    const validation = validateDocumentFile(file);
    if (!validation.valid) throw new BadRequestException(`Invalid document: ${validation.reason}`);

    const application = await this.documents.findOwnedApplication(dossierId, entrepriseId);
    if (!application) throw new NotFoundException('Application not found');
    if (!canUploadDocument(user, application)) throw new ForbiddenException('Application does not accept documents');

    const id = randomUUID();
    const checksum = createHash('sha256').update(file.buffer).digest('hex');
    const storageKey = `companies/${entrepriseId}/applications/${dossierId}/${id}.${validation.extension}`;
    const fileName = this.safeFileName(file.originalname, validation.extension);

    await this.storage.upload(storageKey, file.buffer, validation.mimeType, checksum);
    try {
      await this.documents.create({
        id,
        dossierId,
        typeDocument,
        nomFichier: fileName,
        storageKey,
        mimeType: validation.mimeType,
        tailleOctets: file.buffer.length,
        checksumSha256: checksum,
        uploadedBy: user.sub,
      });
    } catch (error) {
      await this.storage.delete(storageKey).catch(() => undefined);
      throw error;
    }

    return this.documents.findOwnedById(id, entrepriseId);
  }

  async downloadOwn(user: AuthenticatedUser, documentId: string): Promise<DownloadedDocument> {
    const metadata = await this.documents.findOwnedById(documentId, this.enterpriseId(user));
    if (!metadata) throw new NotFoundException('Document not found');
    const document = await this.downloadVerified(metadata);
    await this.documents.recordAccess(documentId, user.sub, 'DOCUMENT_DOWNLOAD_PME');
    return document;
  }

  listForReview() {
    return this.documents.listForReview();
  }

  async downloadForReview(user: AuthenticatedUser, documentId: string): Promise<DownloadedDocument> {
    const metadata = await this.documents.findById(documentId);
    if (!metadata) throw new NotFoundException('Document not found');
    const document = await this.downloadVerified(metadata);
    await this.documents.recordAccess(documentId, user.sub, 'DOCUMENT_DOWNLOAD_AGENT');
    return document;
  }

  async verify(user: AuthenticatedUser, documentId: string, statut: string, commentaire?: string) {
    if (statut !== 'VALIDE' && !commentaire?.trim()) {
      throw new BadRequestException('A comment is required when a document is not validated');
    }
    const updated = await this.documents.verify(documentId, user.sub, statut, commentaire?.trim());
    if (!updated) throw new NotFoundException('Document not found');
    return { id: documentId, statutVerification: statut, verificationComment: commentaire?.trim() ?? null };
  }

  private enterpriseId(user: AuthenticatedUser): string {
    if (!user.entrepriseId) throw new ForbiddenException('Enterprise scope is required');
    return user.entrepriseId;
  }

  private async downloadVerified(metadata: Record<string, unknown>): Promise<DownloadedDocument> {
    const content = await this.storage.download(metadata.storageKey as string);
    const checksum = createHash('sha256').update(content.buffer).digest('hex');
    if (checksum !== metadata.checksumSha256) {
      throw new ServiceUnavailableException('Document integrity verification failed');
    }
    return {
      buffer: content.buffer,
      contentType: metadata.mimeType as string,
      fileName: metadata.nomFichier as string,
    };
  }

  private safeFileName(originalName: string, extension: string): string {
    const leafName = originalName.replace(/\\/g, '/').split('/').pop() ?? 'document';
    const base = leafName
      .normalize('NFKC')
      .replace(/[\\/\0\r\n]/g, '_')
      .replace(/[^\p{L}\p{N}._ -]/gu, '_')
      .slice(0, 220)
      .replace(/\.[^.]+$/, '')
      .trim() || 'document';
    return `${base}.${extension}`;
  }
}
