import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { MetaWhatsAppWebhookService } from './meta-whatsapp-webhook.service';

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

@ApiTags('communications')
@Public()
@Controller('communications/whatsapp/webhooks/meta')
export class MetaWhatsAppWebhookController {
  constructor(private readonly webhooks: MetaWhatsAppWebhookService) {}

  @Get()
  verify(
    @Query('hub.mode') mode: string | undefined,
    @Query('hub.verify_token') token: string | undefined,
    @Query('hub.challenge') challenge: string | undefined,
    @Res() response: Response,
  ) {
    const verifiedChallenge = this.webhooks.verifyChallenge(mode, token, challenge);
    if (!verifiedChallenge) throw new ForbiddenException('Invalid webhook verification');
    return response.status(200).type('text/plain').send(verifiedChallenge);
  }

  @Post()
  async receive(
    @Req() request: RawBodyRequest,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() payload: unknown,
  ) {
    if (!this.webhooks.verifySignature(request.rawBody, signature)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    await this.webhooks.process(payload as Parameters<MetaWhatsAppWebhookService['process']>[0]);
    return { received: true };
  }
}
