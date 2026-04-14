import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ApiAuth } from '../common/decorators/api-auth.decorator';
import { CandidateExperienceService } from './services/candidate-experience.service';
import { CreateWorkExperienceDto } from './dto/create-work-experience.dto';
import { UpdateWorkExperienceDto } from './dto/update-work-experience.dto';
import { CreateEducationDto } from './dto/create-education.dto';
import { UpdateEducationDto } from './dto/update-education.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Controller('candidates')
export class CandidateExperienceController {
  constructor(private readonly experienceService: CandidateExperienceService) {}

  // ─── Work Experiences ───────────────────────────────────────

  @ApiTags('Candidates - Work Experiences')
  @Get('work-experiences')
  @ApiAuth()
  @ApiOperation({ summary: 'Lấy danh sách kinh nghiệm làm việc' })
  @ApiResponse({ status: 200, description: 'Danh sách kinh nghiệm làm việc' })
  getWorkExperiences(@CurrentUser() user: { id: number }) {
    return this.experienceService.getWorkExperiences(user.id);
  }

  @ApiTags('Candidates - Work Experiences')
  @Post('work-experiences')
  @ApiAuth()
  @ApiOperation({ summary: 'Thêm kinh nghiệm làm việc mới' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy hồ sơ ứng viên' })
  createWorkExperience(
    @CurrentUser() user: { id: number },
    @Body() dto: CreateWorkExperienceDto,
  ) {
    return this.experienceService.createWorkExperience(user.id, dto);
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
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWorkExperienceDto,
  ) {
    return this.experienceService.updateWorkExperience(user.id, id, dto);
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
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.experienceService.deleteWorkExperience(user.id, id);
  }

  // ─── Educations ─────────────────────────────────────────────

  @ApiTags('Candidates - Educations')
  @Get('educations')
  @ApiAuth()
  @ApiOperation({ summary: 'Lấy danh sách học vấn' })
  @ApiResponse({ status: 200, description: 'Danh sách học vấn' })
  getEducations(@CurrentUser() user: { id: number }) {
    return this.experienceService.getEducations(user.id);
  }

  @ApiTags('Candidates - Educations')
  @Post('educations')
  @ApiAuth()
  @ApiOperation({ summary: 'Thêm học vấn mới' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy hồ sơ ứng viên' })
  createEducation(
    @CurrentUser() user: { id: number },
    @Body() dto: CreateEducationDto,
  ) {
    return this.experienceService.createEducation(user.id, dto);
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
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEducationDto,
  ) {
    return this.experienceService.updateEducation(user.id, id, dto);
  }

  @ApiTags('Candidates - Educations')
  @Delete('educations/:id')
  @ApiAuth()
  @ApiOperation({ summary: 'Xóa học vấn' })
  @ApiParam({ name: 'id', description: 'ID học vấn' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  @ApiResponse({ status: 403, description: 'Không có quyền xóa' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy học vấn' })
  deleteEducation(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.experienceService.deleteEducation(user.id, id);
  }

  // ─── Projects ─────────────────────────────────────────────

  @ApiTags('Candidates - Projects')
  @Get('projects')
  @ApiAuth()
  @ApiOperation({ summary: 'Lấy danh sách dự án' })
  @ApiResponse({ status: 200, description: 'Danh sách dự án' })
  getProjects(@CurrentUser() user: { id: number }) {
    return this.experienceService.getProjects(user.id);
  }

  @ApiTags('Candidates - Projects')
  @Post('projects')
  @ApiAuth()
  @ApiOperation({ summary: 'Thêm dự án mới' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy hồ sơ ứng viên' })
  createProject(
    @CurrentUser() user: { id: number },
    @Body() dto: CreateProjectDto,
  ) {
    return this.experienceService.createProject(user.id, dto);
  }

  @ApiTags('Candidates - Projects')
  @Put('projects/:id')
  @ApiAuth()
  @ApiOperation({ summary: 'Cập nhật dự án' })
  @ApiParam({ name: 'id', description: 'ID dự án' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 403, description: 'Không có quyền sửa' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy dự án' })
  updateProject(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.experienceService.updateProject(user.id, id, dto);
  }

  @ApiTags('Candidates - Projects')
  @Delete('projects/:id')
  @ApiAuth()
  @ApiOperation({ summary: 'Xóa dự án' })
  @ApiParam({ name: 'id', description: 'ID dự án' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  @ApiResponse({ status: 403, description: 'Không có quyền xóa' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy dự án' })
  deleteProject(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.experienceService.deleteProject(user.id, id);
  }
}
