import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AskSupportDto } from './dto/ask-support.dto';
import { SupportAssistantService } from './support-assistant.service';

@ApiTags('communications')
@ApiBearerAuth()
@Controller('communications/support')
export class SupportController {
  constructor(private readonly assistant: SupportAssistantService) {}

  @Post('assistant')
  ask(@Body() body: AskSupportDto) {
    return this.assistant.answer(body.question);
  }
}
