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
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request } from 'express';
import { EmployerJobsService } from '../services/employer-jobs.service';
import { EmployerJobBumpService } from '../services/employer-job-bump.service';
import { CreateJobDto } from '../dto/create-job.dto';
import { UpdateJobDto } from '../dto/update-job.dto';
import { JobFilterDto } from '../dto/job-filter.dto';
import { ApiAuth } from '../../common/decorators/api-auth.decorator';
import { UserRole } from '../../users/entities/user.entity';

@ApiTags('Jobs - Quản lý Nhà Tuyển Dụng')
@Controller('jobs/employer')
export class EmployerJobsController {
  constructor(
    private readonly employerJobsService: EmployerJobsService,
    private readonly employerJobBumpService: EmployerJobBumpService,
  ) {}

  @Get()
  @ApiAuth(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Lấy danh sách tin tuyển dụng cá nhân tạo ra' })
  getEmployerJobs(@Req() req: Request, @Query() filterDto: JobFilterDto) {
    const user = req.user as { id: number };
    return this.employerJobsService.getEmployerJobs(user.id, filterDto);
  }

  @ApiAuth(UserRole.EMPLOYER, true)
  @Post()
  @ApiOperation({ summary: 'Tạo mới một tin tuyển dụng (Lưu nháp)' })
  createJob(@Req() req: Request, @Body() createJobDto: CreateJobDto) {
    const user = req.user as { id: number };
    return this.employerJobsService.createJob(user.id, createJobDto);
  }

  @Get(':id/history')
  @ApiAuth(UserRole.EMPLOYER)
  @ApiOperation({
    summary: 'Xem lịch sử thay đổi trạng thái của tin (Nhà tuyển dụng)',
  })
  getEmployerJobHistory(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const user = req.user as { id: number };
    return this.employerJobsService.getEmployerJobHistory(user.id, id);
  }

  @Put(':id')
  @ApiAuth(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Cập nhật tin tuyển dụng' })
  updateJob(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateJobDto: UpdateJobDto,
  ) {
    const user = req.user as { id: number };
    return this.employerJobsService.updateJob(user.id, id, updateJobDto);
  }

  @Post(':id/bump')
  @ApiAuth(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Đẩy tin lên đầu trang (Bump Post)' })
  bumpJob(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    const user = req.user as { id: number };
    return this.employerJobBumpService.bumpJob(user.id, id);
  }
}
