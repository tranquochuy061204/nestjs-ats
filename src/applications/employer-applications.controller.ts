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
import { EmployerApplicationsService } from './employer-applications.service';
import { ApplicationFilterDto } from './dto/application-filter.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';
import { CreateApplicationNoteDto } from './dto/create-application-note.dto';
import { UpdateApplicationNoteDto } from './dto/update-application-note.dto';
import type { Request } from 'express';

@ApiTags('Applications - Employer')
@Controller('employer/applications')
export class EmployerApplicationsController {
  constructor(
    private readonly applicationsService: EmployerApplicationsService,
  ) {}

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

  @Get('job/:jobId/kanban')
  @ApiAuth(UserRole.EMPLOYER)
  @ApiOperation({
    summary: 'Xem Kanban Board danh sách ứng viên của 1 tin tuyển dụng',
  })
  @ApiParam({ name: 'jobId', description: 'ID tin tuyển dụng' })
  @ApiResponse({ status: 200, description: 'Cấu trúc Kanban board' })
  @ApiResponse({
    status: 404,
    description: 'Tin tuyển dụng không tồn tại hoặc không thuộc công ty',
  })
  getKanbanBoard(
    @Req() req: Request,
    @Param('jobId', ParseIntPipe) jobId: number,
  ) {
    const user = req.user as { id: number };
    return this.applicationsService.getKanbanBoard(user.id, jobId);
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

  @Post(':id/notes')
  @ApiAuth(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Thêm ghi chú/nhận xét cho đơn ứng tuyển' })
  @ApiParam({ name: 'id', description: 'ID đơn ứng tuyển' })
  @ApiResponse({ status: 201, description: 'Đã thêm ghi chú' })
  @ApiResponse({ status: 404, description: 'Đơn ứng tuyển không tồn tại' })
  addNote(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateApplicationNoteDto,
  ) {
    const user = req.user as { id: number };
    return this.applicationsService.addNote(user.id, id, dto);
  }

  @Patch('notes/:noteId')
  @ApiAuth(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Cập nhật nội dung ghi chú (chỉ người tạo)' })
  @ApiParam({ name: 'noteId', description: 'ID của ghi chú' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 403, description: 'Không có quyền sửa' })
  @ApiResponse({ status: 404, description: 'Ghi chú không tồn tại' })
  updateNote(
    @Req() req: Request,
    @Param('noteId', ParseIntPipe) noteId: number,
    @Body() dto: UpdateApplicationNoteDto,
  ) {
    const user = req.user as { id: number };
    return this.applicationsService.updateNote(user.id, noteId, dto);
  }

  @Post(':id/ai-analyze')
  @ApiAuth(UserRole.EMPLOYER)
  @ApiOperation({
    summary: 'Phân tích ứng viên bằng AI (Tính phí Credit đối với Gói Free)',
    description:
      'Gói Free phải dùng Credit mua sản phẩm ai_scoring. Gói VIP tự động được phân tích miễn phí ngay khi nộp đơn.',
  })
  @ApiParam({ name: 'id', description: 'ID đơn ứng tuyển' })
  @ApiResponse({
    status: 201,
    description: 'Đã mua lượt phân tích thành công và đang xử lý ngầm',
  })
  @ApiResponse({
    status: 400,
    description: 'Không đủ Credit, hoặc Đơn ứng tuyển đã bị rút/từ chối',
  })
  @ApiResponse({ status: 404, description: 'Đơn ứng tuyển không tồn tại' })
  aiAnalyze(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    const user = req.user as { id: number };
    return this.applicationsService.manuallyTriggerAiScoring(user.id, id);
  }
}
