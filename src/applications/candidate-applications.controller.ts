import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ApiAuth } from '../common/decorators/api-auth.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CandidateApplicationsService } from './candidate-applications.service';
import { ApplyJobDto } from './dto/apply-job.dto';
import { ApplicationFilterDto } from './dto/application-filter.dto';
import type { Request } from 'express';

@ApiTags('Applications - Candidate')
@Controller('applications')
export class CandidateApplicationsController {
  constructor(
    private readonly applicationsService: CandidateApplicationsService,
  ) {}

  @Post(':jobId')
  @ApiAuth(UserRole.CANDIDATE)
  @ApiOperation({ summary: 'Ứng tuyển công việc' })
  @ApiParam({ name: 'jobId', description: 'ID tin tuyển dụng' })
  @ApiResponse({ status: 201, description: 'Ứng tuyển thành công' })
  @ApiResponse({ status: 400, description: 'Thiếu CV / Job không hợp lệ' })
  @ApiResponse({ status: 409, description: 'Đã ứng tuyển công việc này' })
  apply(
    @Req() req: Request,
    @Param('jobId', ParseIntPipe) jobId: number,
    @Body() dto: ApplyJobDto,
  ) {
    const user = req.user as { id: number };
    return this.applicationsService.apply(user.id, jobId, dto);
  }

  @Get('me')
  @ApiAuth(UserRole.CANDIDATE)
  @ApiOperation({ summary: 'Xem danh sách đơn ứng tuyển của mình' })
  @ApiResponse({ status: 200, description: 'Danh sách đơn ứng tuyển' })
  getMyApplications(
    @Req() req: Request,
    @Query() filterDto: ApplicationFilterDto,
  ) {
    const user = req.user as { id: number };
    return this.applicationsService.getMyApplications(user.id, filterDto);
  }

  @Get('me/:id')
  @ApiAuth(UserRole.CANDIDATE)
  @ApiOperation({ summary: 'Xem chi tiết 1 đơn ứng tuyển' })
  @ApiParam({ name: 'id', description: 'ID đơn ứng tuyển' })
  @ApiResponse({ status: 200, description: 'Chi tiết đơn ứng tuyển' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đơn' })
  getMyApplicationDetail(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const user = req.user as { id: number };
    return this.applicationsService.getMyApplicationDetail(user.id, id);
  }

  @Patch('me/:id/withdraw')
  @ApiAuth(UserRole.CANDIDATE)
  @ApiOperation({ summary: 'Rút đơn ứng tuyển' })
  @ApiParam({ name: 'id', description: 'ID đơn ứng tuyển' })
  @ApiResponse({ status: 200, description: 'Rút đơn thành công' })
  @ApiResponse({ status: 400, description: 'Đơn không thể rút' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đơn' })
  withdrawApplication(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const user = req.user as { id: number };
    return this.applicationsService.withdrawApplication(user.id, id);
  }
}
