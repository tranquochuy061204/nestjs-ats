import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Get,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiAuth } from '../common/decorators/api-auth.decorator';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { RegisterEmployerDto } from './dto/register-employer.dto';
import { LoginDto } from './dto/login.dto';
import { LocalAuthGuard } from './guards/local.guard';
import { UseGuards } from '@nestjs/common';
import type { Request } from 'express';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Đăng ký tài khoản mới' })
  @ApiResponse({ status: 201, description: 'Đăng ký thành công' })
  @ApiResponse({ status: 409, description: 'Email đã được sử dụng' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('employer/register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Đăng ký tài khoản Nhà tuyển dụng (HR)' })
  @ApiResponse({ status: 201, description: 'Đăng ký thành công' })
  @ApiResponse({ status: 409, description: 'Email đã được sử dụng' })
  async registerEmployer(@Body() dto: RegisterEmployerDto) {
    return this.authService.registerEmployer(dto);
  }

  @Post('login')
  @UseGuards(LocalAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập' })
  @ApiResponse({
    status: 200,
    description: 'Đăng nhập thành công, trả về access_token',
  })
  @ApiResponse({ status: 401, description: 'Email hoặc mật khẩu không đúng' })
  async login(@Body() loginDto: LoginDto) {
    const user = await this.authService.validateUser(loginDto);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.authService.login(user);
  }

  @Get('status')
  @ApiAuth()
  @ApiOperation({ summary: 'Kiểm tra trạng thái đăng nhập' })
  @ApiResponse({ status: 200, description: 'Trả về thông tin user hiện tại' })
  getStatus(@Req() req: Request) {
    return req.user;
  }
}
