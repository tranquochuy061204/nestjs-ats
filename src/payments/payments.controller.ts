import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  Res,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as express from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { EmployerEntity } from '../employers/entities/employer.entity';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import { ApiProperty } from '@nestjs/swagger';

class CreateCreditTopupDto {
  @ApiProperty({
    description: 'ID của Gói nạp',
    example: 'starter',
    enum: ['starter', 'plus', 'pro', 'enterprise'], // Tuỳ theo TopupPackId
  })
  packId: string;
}

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly configService: ConfigService,
    @InjectRepository(EmployerEntity)
    private readonly employerRepo: Repository<EmployerEntity>,
  ) {}

  // ── Mua gói VIP ───────────────────────────────────────

  @Post('vip/create-order')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo đơn hàng mua gói VIP qua VNPay' })
  async createVipOrder(@Req() req: express.Request & { user: { id: number } }) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.paymentsService.createVipOrder(companyId, req);
  }

  // ── Nạp Credit ────────────────────────────────────────

  @Post('credit/create-order')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo đơn hàng nạp Credit qua VNPay' })
  async createCreditTopupOrder(
    @Req() req: express.Request & { user: { id: number } },
    @Body() dto: CreateCreditTopupDto,
  ) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.paymentsService.createCreditTopupOrder(
      companyId,
      dto.packId,
      req,
    );
  }

  // ── VNPay Return URL (user redirect) ─────────────────

  @Get('vnpay/return')
  @ApiOperation({ summary: 'VNPay return URL — hiển thị kết quả thanh toán' })
  async vnpayReturn(
    @Query() query: Record<string, string>,
    @Res() res: express.Response,
  ) {
    const result = await this.paymentsService.processReturnUrl(query);
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:5173',
    );

    // Redirect về trang kết quả thanh toán của FE (React/Next.js)
    const redirectUrl = new URL(`${frontendUrl}/payment/result`);
    redirectUrl.searchParams.set('success', result.success.toString());
    redirectUrl.searchParams.set('orderId', result.orderId || '');
    redirectUrl.searchParams.set('message', result.message);

    return res.redirect(redirectUrl.toString());
  }

  // ── VNPay IPN (server-to-server callback) ────────────

  @Get('vnpay/ipn')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'VNPay IPN callback — xác nhận thanh toán' })
  async vnpayIpn(@Query() query: Record<string, string>) {
    return this.paymentsService.handleVnpayIpn(query);
  }

  // ──────────────────────────────────────────────────────

  private async getCompanyId(userId: number): Promise<number> {
    const employer = await this.employerRepo.findOne({ where: { userId } });
    if (!employer?.companyId) {
      throw new ForbiddenException('Chưa tham gia công ty');
    }
    return employer.companyId;
  }
}
