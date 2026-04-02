import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiAuth } from '../common/decorators/api-auth.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CompaniesService } from './companies.service';
import { RejectJobDto } from '../jobs/dto/reject-job.dto'; // Reuse the same DTO structure for rejection reason

@ApiTags('Admin - Quản lý Doanh nghiệp')
@Controller('admin/companies')
export class AdminCompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get('pending-verification')
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Lấy danh sách doanh nghiệp đang chờ xác thực' })
  @ApiResponse({ status: 200, description: 'Danh sách công ty' })
  getPendingVerifications(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.companiesService.getPendingVerifications(page, limit);
  }

  @Patch(':id/verify')
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Phê duyệt xác thực doanh nghiệp' })
  verifyCompany(@Param('id', ParseIntPipe) id: number) {
    return this.companiesService.verifyCompany(id);
  }

  @Patch(':id/reject-verification')
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Từ chối xác thực doanh nghiệp' })
  rejectVerification(
    @Param('id', ParseIntPipe) id: number,
    @Body() rejectDto: RejectJobDto,
  ) {
    return this.companiesService.rejectVerification(id, rejectDto.reason);
  }

  @Get(':id/history')
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Xem lịch sử duyệt doanh nghiệp (Admin)' })
  getCompanyHistory(@Param('id', ParseIntPipe) id: number) {
    return this.companiesService.getCompanyHistory(id);
  }
}

