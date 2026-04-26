import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import type { TopupPackId } from '../credits/credits.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { EmployerEntity } from '../employers/entities/employer.entity';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

class CreateCreditTopupDto {
  packId: TopupPackId;
}

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    @InjectRepository(EmployerEntity)
    private readonly employerRepo: Repository<EmployerEntity>,
  ) {}

  // ── Mua gói VIP ───────────────────────────────────────

  @Post('vip/create-order')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.EMPLOYER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo đơn hàng mua gói VIP qua VNPay' })
  async createVipOrder(@Req() req: Request & { user: { id: number } }) {
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
    @Req() req: Request & { user: { id: number } },
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
  vnpayReturn(@Query() query: Record<string, string>) {
    return this.paymentsService.verifyReturnUrl(query);
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
    if (!employer?.companyId) throw new Error('Chưa tham gia công ty');
    return employer.companyId;
  }
}
