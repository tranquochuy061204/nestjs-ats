import { Controller, Get, Post, Put, Patch, Body, Param, Query, ParseIntPipe, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import type { Request } from 'express';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { JobFilterDto } from './dto/job-filter.dto';
import { RejectJobDto } from './dto/reject-job.dto';
import { ApiAuth } from '../common/decorators/api-auth.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  // -----------------------
  // PUBLIC APIs
  // -----------------------

  @ApiTags('Jobs - Public')
  @Get('public')
  @ApiOperation({ summary: 'Lấy danh sách các công việc đang mở (Cho ứng viên tìm kiếm)' })
  @ApiResponse({ status: 200, description: 'Danh sách công việc' })
  getPublicJobs(@Query() filterDto: JobFilterDto) {
    return this.jobsService.getPublicJobs(filterDto);
  }

  @ApiTags('Jobs - Public')
  @Get('public/:id')
  @ApiOperation({ summary: 'Lấy chi tiết 1 bài đăng tuyển dụng' })
  @ApiParam({ name: 'id', description: 'ID Job' })
  @ApiResponse({ status: 200, description: 'Chi tiết bài đăng tuyển' })
  getJobDetail(@Param('id', ParseIntPipe) id: number) {
    return this.jobsService.getJobDetail(id);
  }

  // -----------------------
  // ADMIN APIs (Static routes must be above dynamic routes like /:id)
  // -----------------------

  @ApiTags('Jobs - Quản trị Hệ thống')
  @Get('admin/all')
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Lấy tất cả tin tuyển dụng trong hệ thống (Admin)' })
  getAdminJobs(@Query() filterDto: JobFilterDto) {
    return this.jobsService.getAdminJobs(filterDto);
  }

  @ApiTags('Jobs - Quản trị Hệ thống')
  @Get('admin/:id/history')
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Xem lịch sử thay đổi trạng thái của tin (Admin)' })
  getAdminJobHistory(@Param('id', ParseIntPipe) id: number) {
    return this.jobsService.getAdminJobHistory(id);
  }

  @ApiTags('Jobs - Quản trị Hệ thống')
  @Patch('admin/:id/approve')
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Duyệt tin tuyển dụng (Admin)' })
  approveJob(@Param('id', ParseIntPipe) id: number) {
    return this.jobsService.approveJob(id);
  }

  @ApiTags('Jobs - Quản trị Hệ thống')
  @Patch('admin/:id/reject')
  @ApiAuth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Từ chối tin tuyển dụng (Admin)' })
  rejectJob(
    @Param('id', ParseIntPipe) id: number,
    @Body() rejectJobDto: RejectJobDto,
  ) {
    return this.jobsService.rejectJob(id, rejectJobDto.reason);
  }

  // -----------------------
  // EMPLOYER APIs
  // -----------------------

  @ApiTags('Jobs - Quản lý Nhàn Tuyển Dụng')
  @Get()
  @ApiAuth(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Lấy danh sách tin tuyển dụng cá nhân tạo ra' })
  getEmployerJobs(@Req() req: Request, @Query() filterDto: JobFilterDto) {
    const user = req.user as { id: number };
    return this.jobsService.getEmployerJobs(user.id, filterDto);
  }

  @ApiTags('Jobs - Quản lý Nhàn Tuyển Dụng')
  @Post()
  @ApiAuth(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Tạo mới một tin tuyển dụng (Lưu nháp)' })
  createJob(@Req() req: Request, @Body() createJobDto: CreateJobDto) {
    const user = req.user as { id: number };
    return this.jobsService.createJob(user.id, createJobDto);
  }

  @ApiTags('Jobs - Quản lý Nhàn Tuyển Dụng')
  @Get(':id/history')
  @ApiAuth(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Xem lịch sử thay đổi trạng thái của tin (Nhà tuyển dụng)' })
  getEmployerJobHistory(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    const user = req.user as { id: number };
    return this.jobsService.getEmployerJobHistory(user.id, id);
  }

  @ApiTags('Jobs - Quản lý Nhàn Tuyển Dụng')
  @Put(':id')
  @ApiAuth(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Cập nhật tin tuyển dụng' })
  updateJob(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateJobDto: UpdateJobDto,
  ) {
    const user = req.user as { id: number };
    return this.jobsService.updateJob(user.id, id, updateJobDto);
  }
}
