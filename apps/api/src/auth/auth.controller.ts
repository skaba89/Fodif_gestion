import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedUser } from './auth-user.interface';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Authenticate a user and return an access token' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Return the authenticated JWT context' })
  me(@Req() request: AuthenticatedRequest) {
    return request.user;
  }
}
