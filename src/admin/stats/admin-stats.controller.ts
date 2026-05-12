import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AdminStatsService } from './admin-stats.service';
import { ApiAuth } from '../../common/decorators/api-auth.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { TimeFilterDto } from '../../common/dto/time-filter.dto';
import { TimeGranularity, Quarter } from '../../common/enums/time-period.enum';

@ApiTags('Admin - Thống kê Nền tảng')
@Controller('admin/stats')
export class AdminStatsController {
  constructor(private readonly statsService: AdminStatsService) {}

  @Get('overview')
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Lấy tổng quan toàn bộ thống kê nền tảng với time filter',
    description:
      'Mặc định hiển thị stats của tháng hiện tại. Có thể filter theo năm/tháng/quý/ngày cụ thể.',
  })
  @ApiQuery({ name: 'year', required: false, description: 'Năm (2020-2030)' })
  @ApiQuery({
    name: 'granularity',
    enum: TimeGranularity,
    required: false,
    description: 'Độ chi tiết: day, month, quarter',
  })
  @ApiQuery({
    name: 'date',
    required: false,
    description: 'Ngày cụ thể YYYY-MM-DD (dùng khi granularity=day)',
  })
  @ApiQuery({
    name: 'month',
    required: false,
    description: 'Tháng 1-12 (dùng khi granularity=month)',
  })
  @ApiQuery({
    name: 'quarter',
    enum: Quarter,
    required: false,
    description: 'Quý Q1-Q4 (dùng khi granularity=quarter)',
  })
  getOverview(@Query() timeFilter: TimeFilterDto) {
    return this.statsService.getOverview(timeFilter);
  }

  @Get('revenue')
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Dữ liệu biểu đồ doanh thu theo thời gian',
    description:
      'Mặc định hiển thị doanh thu tháng hiện tại. Có thể filter theo năm/tháng/quý/ngày.',
  })
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'granularity', enum: TimeGranularity, required: false })
  @ApiQuery({ name: 'date', required: false })
  @ApiQuery({ name: 'month', required: false })
  @ApiQuery({ name: 'quarter', enum: Quarter, required: false })
  getRevenueChart(@Query() timeFilter: TimeFilterDto) {
    return this.statsService.getRevenueChart(timeFilter);
  }

  @Get('user-growth')
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Biểu đồ tăng trưởng người dùng',
    description:
      'Mặc định hiển thị user growth tháng hiện tại. Có thể filter theo năm/tháng/quý/ngày.',
  })
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'granularity', enum: TimeGranularity, required: false })
  @ApiQuery({ name: 'date', required: false })
  @ApiQuery({ name: 'month', required: false })
  @ApiQuery({ name: 'quarter', enum: Quarter, required: false })
  getUserGrowthChart(@Query() timeFilter: TimeFilterDto) {
    return this.statsService.getUserGrowthChart(timeFilter);
  }
}
