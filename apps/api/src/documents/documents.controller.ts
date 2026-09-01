import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import { AuthenticatedUser } from '../auth/auth-user.interface';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { MAX_DOCUMENT_BYTES } from '../document-policy';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { VerifyDocumentDto } from './dto/verify-document.dto';
import { DocumentsService } from './documents.service';

interface AuthenticatedRequest extends Request { user: AuthenticatedUser }

@ApiTags('documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get('applications/:dossierId')
  @RequireRoles('PME')
  @RequirePermissions('document.own.read')
  listOwn(
    @Req() request: AuthenticatedRequest,
    @Param('dossierId', new ParseUUIDPipe()) dossierId: string,
  ) {
    return this.documents.listOwn(request.user, dossierId);
  }

  @Post('applications/:dossierId')
  @RequireRoles('PME')
  @RequirePermissions('document.own.upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1 } }))
  uploadOwn(
    @Req() request: AuthenticatedRequest,
    @Param('dossierId', new ParseUUIDPipe()) dossierId: string,
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.documents.uploadOwn(request.user, dossierId, dto.typeDocument, file);
  }

  @Get(':documentId/download')
  @RequireRoles('PME')
  @RequirePermissions('document.own.read')
  async downloadOwn(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
  ) {
    const document = await this.documents.downloadOwn(request.user, documentId);
    response.set({
      'Content-Type': document.contentType,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(document.buffer);
  }

  @Get('review/pending')
  @RequireRoles('AGENT_FODIP', 'SUPER_ADMIN')
  @RequirePermissions('document.read')
  listForReview() {
    return this.documents.listForReview();
  }

  @Get('review/:documentId/download')
  @RequireRoles('AGENT_FODIP', 'SUPER_ADMIN')
  @RequirePermissions('document.read')
  async downloadForReview(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
  ) {
    const document = await this.documents.downloadForReview(request.user, documentId);
    response.set({
      'Content-Type': document.contentType,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(document.buffer);
  }

  @Post(':documentId/verification')
  @RequireRoles('AGENT_FODIP', 'SUPER_ADMIN')
  @RequirePermissions('document.verify')
  verify(
    @Req() request: AuthenticatedRequest,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
    @Body() dto: VerifyDocumentDto,
  ) {
    return this.documents.verify(request.user, documentId, dto.statut, dto.commentaire);
  }
}
