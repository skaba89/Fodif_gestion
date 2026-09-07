import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { trackAuthenticatedSession } from '../../common/throttle-tracker';
import { AskSupportDto } from './dto/ask-support.dto';
import { SupportAssistantService } from './support-assistant.service';

@ApiTags('communications')
@ApiBearerAuth()
@Controller('communications/support')
export class SupportController {
  constructor(private readonly assistant: SupportAssistantService) {}

  @Throttle({
    default: {
      limit: 30,
      ttl: 60_000,
      getTracker: trackAuthenticatedSession,
    },
  })
  @Post('assistant')
  ask(@Body() body: AskSupportDto) {
    return this.assistant.answer(body.question);
  }
}
