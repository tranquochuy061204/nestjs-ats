// Core & Config
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request } from 'express';

// Services
import { AdminCompaniesService } from './admin-companies.service';

// DTOs
import { AdminCompanyFilterDto } from './dto/admin-company-filter.dto';
import { AdminAdjustCreditDto } from './dto/admin-adjust-credit.dto';

// Shared
import { ApiAuth } from '../../common/decorators/api-auth.decorator';
import { UserRole } from '../../users/entities/user.entity';

@ApiTags('Admin - Quản lý Công ty')
@Controller('admin/companies')
export class AdminCompaniesController {
  constructor(private readonly adminCompaniesService: AdminCompaniesService) {}

  @Get()
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Danh sách tất cả công ty (có filter & search)' })
  getCompanies(@Query() filter: AdminCompanyFilterDto) {
    return this.adminCompaniesService.getCompanies(filter);
  }

  @Get(':id')
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Chi tiết công ty' })
  getCompanyById(@Param('id', ParseIntPipe) id: number) {
    return this.adminCompaniesService.getCompanyById(id);
  }

  @Get(':id/subscription')
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Trạng thái VIP hiện tại của công ty' })
  getCompanySubscription(@Param('id', ParseIntPipe) id: number) {
    return this.adminCompaniesService.getCompanySubscription(id);
  }

  @Get(':id/payment-history')
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Lịch sử thanh toán của công ty' })
  getPaymentHistory(
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminCompaniesService.getPaymentHistory(id, page, limit);
  }

  @Get(':id/credit-wallet')
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Ví credit của công ty + 10 giao dịch gần nhất' })
  getCreditWallet(@Param('id', ParseIntPipe) id: number) {
    return this.adminCompaniesService.getCreditWallet(id);
  }

  @Get(':id/jobs')
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Tin tuyển dụng của công ty (Admin)' })
  getCompanyJobs(
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminCompaniesService.getCompanyJobs(id, page, limit);
  }

  @Post(':id/credits/adjust')
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Admin điều chỉnh credit thủ công (bắt buộc ghi lý do)',
  })
  adjustCredit(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminAdjustCreditDto,
    @Req() req: Request,
  ) {
    return this.adminCompaniesService.adjustCredit(id, dto, (req.user as any).id);
  }
}
