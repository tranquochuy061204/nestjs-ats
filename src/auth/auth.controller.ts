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
  BadRequestException,
  Query,
  Patch,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

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
      result.jti,
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

    await this.authService.storeRefreshToken(
      result.user.id,
      result.refresh_token,
      result.jti,
      req.headers['user-agent'],
      req.ip,
    );
    this.authService.setRefreshTokenCookie(res, result.refresh_token);

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
    @CurrentUser() user: { id: number; refreshToken?: string; jti: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { id, refreshToken } = user;
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const tokens = await this.authService.refreshTokens(
      id,
      user.jti,
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
    @CurrentUser() user: { id: number; refreshToken?: string; jti?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { id, jti } = user;
    await this.authService.logout(id, jti);
    this.authService.clearRefreshTokenCookie(res);
    return { message: 'Logged out successfully' };
  }

  @Get('status')
  @ApiAuth()
  @ApiOperation({ summary: 'Kiểm tra trạng thái đăng nhập' })
  @ApiResponse({ status: 200, description: 'Trả về thông tin user hiện tại' })
  async getStatus(@CurrentUser() user: Record<string, unknown>) {
    const isVerified = await this.authService.checkEmailVerified(
      Number(user.id),
    );
    return {
      ...user,
      isEmailVerified: isVerified,
    };
  }

  // -----------------------------------------------------------------------
  // ACCOUNT MANAGEMENT (PHASE 2)
  // -----------------------------------------------------------------------

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Yêu cầu gửi mã đặt lại mật khẩu' })
  @ApiResponse({ status: 200, description: 'Đã gửi mã xác minh (nếu có)' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đặt lại mật khẩu với mã PIN 6 số' })
  @ApiResponse({ status: 200, description: 'Cập nhật mật khẩu thành công' })
  @ApiResponse({ status: 400, description: 'Mã xác nhận sai hoặc hết hạn' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Patch('change-password')
  @ApiAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đổi mật khẩu (yêu cầu đăng nhập)' })
  @ApiResponse({ status: 200, description: 'Đổi mật khẩu thành công' })
  @ApiResponse({ status: 400, description: 'Mật khẩu cũ không chính xác' })
  async changePassword(
    @CurrentUser() user: { id: number },
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, dto);
  }

  @Post('logout-all')
  @ApiAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng xuất khỏi tất cả thiết bị' })
  @ApiResponse({ status: 200, description: 'Đã force logout mọi phiên' })
  async logoutAll(@CurrentUser() user: { id: number }) {
    return this.authService.logoutAllDevices(user.id);
  }

  // -----------------------------------------------------------------------
  // EMAIL VERIFICATION
  // -----------------------------------------------------------------------

  @Get('verify-email')
  @ApiOperation({ summary: 'Xác thực email qua token (click link từ email)' })
  @ApiResponse({ status: 302, description: 'Chuyển hướng về Frontend' })
  async verifyEmail(@Query('token') token: string, @Res() res: Response) {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';

    try {
      if (!token || !/^[a-f0-9]{64}$/.test(token)) {
        throw new BadRequestException('Mã xác thực không đúng định dạng');
      }
      await this.authService.verifyEmail(token);
      return res.redirect(`${frontendUrl}/verify-email?status=success`);
    } catch {
      return res.redirect(`${frontendUrl}/verify-email?status=error`);
    }
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiAuth()
  @ApiOperation({ summary: 'Gửi lại email xác thực (yêu cầu đăng nhập)' })
  @ApiResponse({ status: 200, description: 'Email xác thực đã được gửi lại' })
  @ApiResponse({ status: 400, description: 'Email đã được xác thực rồi' })
  resendVerification(@CurrentUser() user: { id: number }) {
    return this.authService.resendVerificationEmail(user.id);
  }
}
