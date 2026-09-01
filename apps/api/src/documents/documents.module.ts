import { Module } from '@nestjs/common';
import { DocumentStorageService } from './document-storage.service';
import { DocumentsController } from './documents.controller';
import { DocumentsRepository } from './documents.repository';
import { DocumentsService } from './documents.service';

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsRepository, DocumentStorageService, DocumentsService],
})
export class DocumentsModule {}
