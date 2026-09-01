import { IsIn, IsString } from 'class-validator';
import { ALLOWED_DOCUMENT_TYPES } from '../../document-policy';

export class UploadDocumentDto {
  @IsString()
  @IsIn([...ALLOWED_DOCUMENT_TYPES])
  typeDocument!: string;
}
