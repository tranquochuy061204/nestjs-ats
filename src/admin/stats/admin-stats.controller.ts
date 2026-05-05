import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AdminStatsService } from './admin-stats.service';
import { ApiAuth } from '../../common/decorators/api-auth.decorator';
import { UserRole } from '../../users/entities/user.entity';

@ApiTags('Admin - Thống kê Nền tảng')
@Controller('admin/stats')
export class AdminStatsController {
  constructor(private readonly statsService: AdminStatsService) {}

  @Get('overview')
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Lấy tổng quan toàn bộ thống kê nền tảng' })
  getOverview() {
    return this.statsService.getOverview();
  }

  @Get('revenue')
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Dữ liệu biểu đồ doanh thu theo thời gian' })
  @ApiQuery({
    name: 'period',
    enum: ['daily', 'weekly', 'monthly'],
    required: false,
  })
  @ApiQuery({ name: 'from', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: false, description: 'YYYY-MM-DD' })
  getRevenueChart(
    @Query('period') period: 'daily' | 'weekly' | 'monthly' = 'daily',
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.statsService.getRevenueChart(period, from, to);
  }

  @Get('user-growth')
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Biểu đồ tăng trưởng người dùng' })
  @ApiQuery({
    name: 'period',
    enum: ['daily', 'weekly', 'monthly'],
    required: false,
  })
  getUserGrowthChart(
    @Query('period') period: 'daily' | 'weekly' | 'monthly' = 'weekly',
  ) {
    return this.statsService.getUserGrowthChart(period);
  }
}
