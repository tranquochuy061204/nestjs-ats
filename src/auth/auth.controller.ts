import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { Response, Request } from 'express';
import { UserEntity } from '../users/entities/user.entity';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { ApiAuth } from '../common/decorators/api-auth.decorator';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { RegisterEmployerDto } from './dto/register-employer.dto';
import { LoginDto } from './dto/login.dto';
import { LocalAuthGuard } from './guards/local.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Đăng ký tài khoản mới' })
  @ApiResponse({ status: 201, description: 'Đăng ký thành công' })
  @ApiResponse({ status: 409, description: 'Email đã được sử dụng' })
  async register(
    @Req() _req: Request,
    @Res({ passthrough: true }) _res: Response,
    @Body() registerDto: RegisterDto,
  ) {
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
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Đăng nhập thành công, trả về access_token',
  })
  @ApiResponse({ status: 401, description: 'Email hoặc mật khẩu không đúng' })
  async login(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // User được lấy từ Passport LocalStrategy
    const user = req.user as UserEntity;
    const result = await this.authService.login(user);

    // Lưu Refresh Token vào Token Table & HttpOnly Cookie
    await this.authService.storeRefreshToken(
      user.id,
      result.refresh_token,
      req.headers['user-agent'],
      req.ip,
    );
    this.authService.setRefreshTokenCookie(res, result.refresh_token);

    // Loại bỏ refresh_token khỏi Body trả về (đã nằm trong cookie)
    return {
      access_token: result.access_token,
      user: result.user,
    };
  }

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập Quản trị viên (Dedicated Endpoint)' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Đăng nhập thành công' })
  @ApiResponse({
    status: 401,
    description: 'Không có quyền truy cập hoặc sai thông tin',
  })
  async adminLogin(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() loginDto: LoginDto,
  ) {
    const result = await this.authService.loginAdmin(loginDto);
    const user = await this.authService.validateUser(loginDto);

    if (user) {
      await this.authService.storeRefreshToken(
        user.id,
        result.refresh_token,
        req.headers['user-agent'],
        req.ip,
      );
      this.authService.setRefreshTokenCookie(res, result.refresh_token);
    }

    return {
      access_token: result.access_token,
      user: result.user,
    };
  }

  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Làm mới Access Token (Silent Refresh)' })
  async refresh(
    @Req() req: Request,
    @CurrentUser() user: { id: number; refreshToken?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { id, refreshToken } = user;
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const tokens = await this.authService.refreshTokens(
      id,
      refreshToken,
      req.headers['user-agent'],
      req.ip,
    );

    this.authService.setRefreshTokenCookie(res, tokens.refresh_token);
    return { access_token: tokens.access_token };
  }

  @Post('logout')
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng xuất' })
  async logout(
    @CurrentUser() user: { id: number; refreshToken?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { id, refreshToken } = user;
    if (refreshToken) {
      await this.authService.logout(id, refreshToken);
    }
    this.authService.clearRefreshTokenCookie(res);
    return { message: 'Logged out successfully' };
  }

  @Get('status')
  @ApiAuth()
  @ApiOperation({ summary: 'Kiểm tra trạng thái đăng nhập' })
  @ApiResponse({ status: 200, description: 'Trả về thông tin user hiện tại' })
  getStatus(@CurrentUser() user: Record<string, unknown>) {
    return user;
  }
}
