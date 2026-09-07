import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/auth-user.interface';
import { CommunicationsService } from './communications.service';
import { UpdateWhatsAppPreferenceDto } from './dto/update-whatsapp-preference.dto';

interface AuthenticatedRequest extends Request { user: AuthenticatedUser }

@ApiTags('communications')
@ApiBearerAuth()
@Controller('communications/whatsapp')
export class CommunicationsController {
  constructor(private readonly communications: CommunicationsService) {}

  @Get('preference')
  getPreference(@Req() request: AuthenticatedRequest) {
    return this.communications.getOwnPreference(request.user.sub);
  }

  @Patch('preference')
  updatePreference(
    @Req() request: AuthenticatedRequest,
    @Body() body: UpdateWhatsAppPreferenceDto,
  ) {
    return this.communications.updateOwnPreference(
      request.user.sub,
      body.consent,
      body.telephoneE164,
    );
  }
}
