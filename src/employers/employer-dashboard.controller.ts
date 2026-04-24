import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuth } from '../common/decorators/api-auth.decorator';
import { UserRole } from '../users/entities/user.entity';
import { EmployerDashboardService } from './services/employer-dashboard.service';
import { DashboardFilterDto } from './dto/dashboard-filter.dto';
import type { Request } from 'express';
import { Req } from '@nestjs/common';

@ApiTags('Employers - Dashboard')
@Controller('employers/dashboard')
export class EmployerDashboardController {
  constructor(
    private readonly dashboardService: EmployerDashboardService,
  ) {}

  @Get('stats')
  @ApiAuth(UserRole.EMPLOYER)
  @ApiOperation({
    summary: 'Thống kê tổng quan công ty (Dashboard Overview)',
    description:
      'Trả về toàn bộ metrics của công ty: job counts, application pipeline, conversion rate, trend 7 ngày, headhunting stats, top jobs.',
  })
  @ApiResponse({ status: 200, description: 'Dashboard stats thành công' })
  @ApiResponse({
    status: 403,
    description: 'Không phải Employer hoặc chưa thuộc công ty',
  })
  getCompanyStats(
    @Req() req: Request,
    @Query() dto: DashboardFilterDto,
  ) {
    const user = req.user as { id: number };
    return this.dashboardService.getCompanyStats(user.id, dto);
  }

  @Get('jobs/:jobId/stats')
  @ApiAuth(UserRole.EMPLOYER)
  @ApiOperation({
    summary: 'Thống kê chi tiết cho 1 tin tuyển dụng (Per-Job Drill-down)',
    description:
      'Trả về application pipeline, conversion rate, trend 7 ngày và invitation stats cho 1 job cụ thể.',
  })
  @ApiParam({ name: 'jobId', description: 'ID tin tuyển dụng' })
  @ApiResponse({ status: 200, description: 'Job stats thành công' })
  @ApiResponse({
    status: 404,
    description: 'Tin tuyển dụng không tồn tại hoặc không thuộc công ty',
  })
  getJobStats(
    @Req() req: Request,
    @Param('jobId', ParseIntPipe) jobId: number,
  ) {
    const user = req.user as { id: number };
    return this.dashboardService.getJobDashboard(user.id, jobId);
  }
}
