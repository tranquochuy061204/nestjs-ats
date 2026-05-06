// Core & Config
import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseIntPipe,
  Req,
  Delete,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';

// Services
import { AdminVipService } from './admin-vip.service';

// DTOs
import { UpdateSubscriptionPackageDto } from './dto/update-subscription-package.dto';

// Shared
import { ApiAuth } from '../../common/decorators/api-auth.decorator';
import { UserRole } from '../../users/entities/user.entity';

@ApiTags('Admin - Quản lý VIP')
@Controller('admin/vip')
export class AdminVipController {
  constructor(private readonly adminVipService: AdminVipService) {}

  // ─── Subscriptions ────────────────────────────────────────────────────────

  @Get('subscriptions')
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Danh sách company đang dùng VIP' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'packageId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getSubscriptions(
    @Query('status') status?: string,
    @Query('packageId') packageId?: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminVipService.getSubscriptions({
      status,
      packageId,
      page,
      limit,
    });
  }

  @Get('subscriptions/expiring')
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Danh sách VIP sắp hết hạn' })
  @ApiQuery({
    name: 'days',
    required: false,
    description: 'Số ngày tới (mặc định: 7)',
  })
  getExpiring(@Query('days') days?: number) {
    return this.adminVipService.getExpiring(days ? Number(days) : 7);
  }

  @Post('subscriptions/:id/cancel')
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Hủy subscription (Admin)' })
  cancelSubscription(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    const adminId = (req.user as any)?.id;
    if (!adminId) throw new BadRequestException('Admin session invalid');
    return this.adminVipService.cancelSubscription(id, adminId);
  }

  // ─── Packages ─────────────────────────────────────────────────────────────

  @Get('packages')
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Danh sách tất cả gói VIP' })
  getAllPackages() {
    return this.adminVipService.getAllPackages();
  }

  @Get('packages/:id')
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Chi tiết gói VIP' })
  getPackageById(@Param('id', ParseIntPipe) id: number) {
    return this.adminVipService.getPackageById(id);
  }

  @Post('packages')
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Tạo gói VIP mới' })
  createPackage(@Body() dto: UpdateSubscriptionPackageDto & { name: string }) {
    return this.adminVipService.createPackage(dto);
  }

  @Patch('packages/:id')
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Cập nhật cấu hình gói VIP (giá, thời hạn, quyền lợi)',
  })
  updatePackage(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSubscriptionPackageDto,
    @Req() req: Request,
  ) {
    const adminId = (req.user as any)?.id;
    if (!adminId) throw new BadRequestException('Admin session invalid');
    return this.adminVipService.updatePackage(id, dto, adminId);
  }

  @Delete('packages/:id')
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Xóa gói VIP' })
  deletePackage(@Param('id', ParseIntPipe) id: number) {
    return this.adminVipService.deletePackage(id);
  }
}
