import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AdminJobsService } from '../services/admin-jobs.service';
import { JobFilterDto } from '../dto/job-filter.dto';
import { RejectJobDto } from '../dto/reject-job.dto';
import { ApiAuth } from '../../common/decorators/api-auth.decorator';
import { UserRole } from '../../users/entities/user.entity';

@ApiTags('Jobs - Quản trị Hệ thống')
@Controller('jobs/admin')
export class AdminJobsController {
  constructor(private readonly adminJobsService: AdminJobsService) {}

  @Get('all')
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Lấy tất cả tin tuyển dụng trong hệ thống (Admin)' })
  getAdminJobs(@Query() filterDto: JobFilterDto) {
    return this.adminJobsService.getAdminJobs(filterDto);
  }

  @Get(':id/history')
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Xem lịch sử thay đổi trạng thái của tin (Admin)' })
  getAdminJobHistory(@Param('id', ParseIntPipe) id: number) {
    return this.adminJobsService.getAdminJobHistory(id);
  }

  @Patch(':id/approve')
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Duyệt tin tuyển dụng (Admin)' })
  approveJob(@Param('id', ParseIntPipe) id: number) {
    return this.adminJobsService.approveJob(id);
  }

  @Patch(':id/reject')
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Từ chối tin tuyển dụng (Admin)' })
  rejectJob(
    @Param('id', ParseIntPipe) id: number,
    @Body() rejectJobDto: RejectJobDto,
  ) {
    return this.adminJobsService.rejectJob(id, rejectJobDto.reason);
  }
}
