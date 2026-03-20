import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ApiAuth } from '../common/decorators/api-auth.decorator';
import { CandidatesService } from './candidates.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateWorkExperienceDto } from './dto/create-work-experience.dto';
import { UpdateWorkExperienceDto } from './dto/update-work-experience.dto';
import { CreateEducationDto } from './dto/create-education.dto';
import { UpdateEducationDto } from './dto/update-education.dto';
import type { Request } from 'express';

@Controller('candidates')
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  // ─── Profile ────────────────────────────────────────────────

  @ApiTags('Candidates - Profile')
  @Put('profile')
  @ApiAuth()
  @ApiOperation({ summary: 'Cập nhật hồ sơ ứng viên' })
  @ApiResponse({ status: 200, description: 'Cập nhật hồ sơ thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy hồ sơ ứng viên' })
  updateProfile(
    @Req() req: Request,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    const user = req.user as { id: number; email: string; role: string };
    return this.candidatesService.updateProfile(user.id, updateProfileDto);
  }

  // ─── Work Experiences ───────────────────────────────────────

  @ApiTags('Candidates - Work Experiences')
  @Get('work-experiences')
  @ApiAuth()
  @ApiOperation({ summary: 'Lấy danh sách kinh nghiệm làm việc' })
  @ApiResponse({ status: 200, description: 'Danh sách kinh nghiệm làm việc' })
  getWorkExperiences(@Req() req: Request) {
    const user = req.user as { id: number };
    return this.candidatesService.getWorkExperiences(user.id);
  }

  @ApiTags('Candidates - Work Experiences')
  @Post('work-experiences')
  @ApiAuth()
  @ApiOperation({ summary: 'Thêm kinh nghiệm làm việc mới' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy hồ sơ ứng viên' })
  createWorkExperience(
    @Req() req: Request,
    @Body() dto: CreateWorkExperienceDto,
  ) {
    const user = req.user as { id: number };
    return this.candidatesService.createWorkExperience(user.id, dto);
  }

  @ApiTags('Candidates - Work Experiences')
  @Put('work-experiences/:id')
  @ApiAuth()
  @ApiOperation({ summary: 'Cập nhật kinh nghiệm làm việc' })
  @ApiParam({ name: 'id', description: 'ID kinh nghiệm làm việc' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 403, description: 'Không có quyền sửa' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy kinh nghiệm' })
  updateWorkExperience(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWorkExperienceDto,
  ) {
    const user = req.user as { id: number };
    return this.candidatesService.updateWorkExperience(user.id, id, dto);
  }

  @ApiTags('Candidates - Work Experiences')
  @Delete('work-experiences/:id')
  @ApiAuth()
  @ApiOperation({ summary: 'Xóa kinh nghiệm làm việc' })
  @ApiParam({ name: 'id', description: 'ID kinh nghiệm làm việc' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  @ApiResponse({ status: 403, description: 'Không có quyền xóa' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy kinh nghiệm' })
  deleteWorkExperience(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const user = req.user as { id: number };
    return this.candidatesService.deleteWorkExperience(user.id, id);
  }

  // ─── Educations ─────────────────────────────────────────────

  @ApiTags('Candidates - Educations')
  @Get('educations')
  @ApiAuth()
  @ApiOperation({ summary: 'Lấy danh sách học vấn' })
  @ApiResponse({ status: 200, description: 'Danh sách học vấn' })
  getEducations(@Req() req: Request) {
    const user = req.user as { id: number };
    return this.candidatesService.getEducations(user.id);
  }

  @ApiTags('Candidates - Educations')
  @Post('educations')
  @ApiAuth()
  @ApiOperation({ summary: 'Thêm học vấn mới' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy hồ sơ ứng viên' })
  createEducation(@Req() req: Request, @Body() dto: CreateEducationDto) {
    const user = req.user as { id: number };
    return this.candidatesService.createEducation(user.id, dto);
  }

  @ApiTags('Candidates - Educations')
  @Put('educations/:id')
  @ApiAuth()
  @ApiOperation({ summary: 'Cập nhật học vấn' })
  @ApiParam({ name: 'id', description: 'ID học vấn' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 403, description: 'Không có quyền sửa' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy học vấn' })
  updateEducation(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEducationDto,
  ) {
    const user = req.user as { id: number };
    return this.candidatesService.updateEducation(user.id, id, dto);
  }

  @ApiTags('Candidates - Educations')
  @Delete('educations/:id')
  @ApiAuth()
  @ApiOperation({ summary: 'Xóa học vấn' })
  @ApiParam({ name: 'id', description: 'ID học vấn' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  @ApiResponse({ status: 403, description: 'Không có quyền xóa' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy học vấn' })
  deleteEducation(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    const user = req.user as { id: number };
    return this.candidatesService.deleteEducation(user.id, id);
  }
}
