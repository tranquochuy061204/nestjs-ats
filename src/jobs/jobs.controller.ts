import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import type { Request } from 'express';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { JobFilterDto } from './dto/job-filter.dto';
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
  @ApiOperation({
    summary: 'Lấy danh sách các công việc đang mở (Cho ứng viên tìm kiếm)',
  })
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
  // EMPLOYER APIs
  // -----------------------

  @ApiTags('Jobs - Quản lý Nhàn Tuyển Dụng')
  @Post()
  @ApiAuth(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Tạo mới một tin tuyển dụng (Lưu nháp)' })
  createJob(@Req() req: Request, @Body() createJobDto: CreateJobDto) {
    const user = req.user as { id: number };
    return this.jobsService.createJob(user.id, createJobDto);
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

  @ApiTags('Jobs - Quản lý Nhàn Tuyển Dụng')
  @Get()
  @ApiAuth(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Lấy danh sách tin tuyển dụng cá nhân tạo ra' })
  getEmployerJobs(@Req() req: Request, @Query() filterDto: JobFilterDto) {
    const user = req.user as { id: number };
    return this.jobsService.getEmployerJobs(user.id, filterDto);
  }
}
