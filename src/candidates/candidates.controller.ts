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
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddSkillsDto } from './dto/add-skills.dto';
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

  // ─── Projects ─────────────────────────────────────────────

  @ApiTags('Candidates - Projects')
  @Get('projects')
  @ApiAuth()
  @ApiOperation({ summary: 'Lấy danh sách dự án' })
  @ApiResponse({ status: 200, description: 'Danh sách dự án' })
  getProjects(@Req() req: Request) {
    const user = req.user as { id: number };
    return this.candidatesService.getProjects(user.id);
  }

  @ApiTags('Candidates - Projects')
  @Post('projects')
  @ApiAuth()
  @ApiOperation({ summary: 'Thêm dự án mới' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy hồ sơ ứng viên' })
  createProject(@Req() req: Request, @Body() dto: CreateProjectDto) {
    const user = req.user as { id: number };
    return this.candidatesService.createProject(user.id, dto);
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
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProjectDto,
  ) {
    const user = req.user as { id: number };
    return this.candidatesService.updateProject(user.id, id, dto);
  }

  @ApiTags('Candidates - Projects')
  @Delete('projects/:id')
  @ApiAuth()
  @ApiOperation({ summary: 'Xóa dự án' })
  @ApiParam({ name: 'id', description: 'ID dự án' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  @ApiResponse({ status: 403, description: 'Không có quyền xóa' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy dự án' })
  deleteProject(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    const user = req.user as { id: number };
    return this.candidatesService.deleteProject(user.id, id);
  }

  // ─── Skills ─────────────────────────────────────────────────

  @ApiTags('Candidates - Skills')
  @Get('skills')
  @ApiAuth()
  @ApiOperation({ summary: 'Lấy danh sách skills của mình' })
  @ApiResponse({ status: 200, description: 'Danh sách skills' })
  getSkills(@Req() req: Request) {
    const user = req.user as { id: number };
    return this.candidatesService.getSkills(user.id);
  }

  @ApiTags('Candidates - Skills')
  @Post('skills')
  @ApiAuth()
  @ApiOperation({
    summary: 'Thêm skills (hỗn hợp ID + string, AI format cho string)',
  })
  @ApiResponse({ status: 201, description: 'Thêm thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy hồ sơ ứng viên' })
  addSkills(@Req() req: Request, @Body() dto: AddSkillsDto) {
    const user = req.user as { id: number };
    return this.candidatesService.addSkills(user.id, dto);
  }

  @ApiTags('Candidates - Skills')
  @Delete('skills/:id')
  @ApiAuth()
  @ApiOperation({ summary: 'Xóa 1 skill' })
  @ApiParam({ name: 'id', description: 'ID của candidate_skill_tag' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  @ApiResponse({ status: 403, description: 'Không có quyền xóa' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy skill' })
  deleteSkill(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    const user = req.user as { id: number };
    return this.candidatesService.deleteSkill(user.id, id);
  }
}
