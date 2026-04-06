import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ApiAuth } from '../common/decorators/api-auth.decorator';
import { UserRole } from '../users/entities/user.entity';
import { ApplicationsService } from './applications.service';
import { ApplicationFilterDto } from './dto/application-filter.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';
import type { Request } from 'express';

@ApiTags('Applications - Employer')
@Controller('employer/applications')
export class EmployerApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get('job/:jobId')
  @ApiAuth(UserRole.EMPLOYER)
  @ApiOperation({
    summary: 'Xem danh sách ứng viên nộp đơn cho 1 tin tuyển dụng',
  })
  @ApiParam({ name: 'jobId', description: 'ID tin tuyển dụng' })
  @ApiResponse({ status: 200, description: 'Danh sách ứng viên' })
  @ApiResponse({
    status: 404,
    description: 'Tin tuyển dụng không tồn tại hoặc không thuộc công ty',
  })
  getJobApplications(
    @Req() req: Request,
    @Param('jobId', ParseIntPipe) jobId: number,
    @Query() filterDto: ApplicationFilterDto,
  ) {
    const user = req.user as { id: number };
    return this.applicationsService.getJobApplications(
      user.id,
      jobId,
      filterDto,
    );
  }

  @Get(':id')
  @ApiAuth(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Xem chi tiết hồ sơ ứng viên ứng tuyển' })
  @ApiParam({ name: 'id', description: 'ID đơn ứng tuyển' })
  @ApiResponse({
    status: 200,
    description: 'Chi tiết hồ sơ ứng viên',
  })
  @ApiResponse({ status: 404, description: 'Đơn ứng tuyển không tồn tại' })
  getApplicationDetail(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const user = req.user as { id: number };
    return this.applicationsService.getApplicationDetail(user.id, id);
  }

  @Patch(':id/status')
  @ApiAuth(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Cập nhật trạng thái đơn ứng tuyển' })
  @ApiParam({ name: 'id', description: 'ID đơn ứng tuyển' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({
    status: 400,
    description: 'Trạng thái không hợp lệ / Đơn đã bị rút',
  })
  @ApiResponse({ status: 404, description: 'Đơn ứng tuyển không tồn tại' })
  updateApplicationStatus(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateApplicationStatusDto,
  ) {
    const user = req.user as { id: number };
    return this.applicationsService.updateApplicationStatus(user.id, id, dto);
  }

  @Get(':id/history')
  @ApiAuth(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Xem lịch sử thay đổi trạng thái đơn ứng tuyển' })
  @ApiParam({ name: 'id', description: 'ID đơn ứng tuyển' })
  @ApiResponse({ status: 200, description: 'Lịch sử trạng thái' })
  @ApiResponse({ status: 404, description: 'Đơn ứng tuyển không tồn tại' })
  getApplicationHistory(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const user = req.user as { id: number };
    return this.applicationsService.getApplicationHistory(user.id, id);
  }
}
