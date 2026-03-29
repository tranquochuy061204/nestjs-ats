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
  UseInterceptors,
  UploadedFile,
  ParseFilePipeBuilder,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiAuth } from '../common/decorators/api-auth.decorator';
import { CandidateProfileService } from './services/candidate-profile.service';
import { CandidateExperienceService } from './services/candidate-experience.service';
import { CandidateSkillsService } from './services/candidate-skills.service';
import { CandidateCertificatesService } from './services/candidate-certificates.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateWorkExperienceDto } from './dto/create-work-experience.dto';
import { UpdateWorkExperienceDto } from './dto/update-work-experience.dto';
import { CreateEducationDto } from './dto/create-education.dto';
import { UpdateEducationDto } from './dto/update-education.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { CreateCertificateDto } from './dto/create-certificate.dto';
import { UpdateCertificateDto } from './dto/update-certificate.dto';
import { AddSkillsDto } from './dto/add-skills.dto';
import { UpdateJobCategoriesDto } from './dto/update-job-categories.dto';
import type { Request } from 'express';

@Controller('candidates')
export class CandidatesController {
  constructor(
    private readonly profileService: CandidateProfileService,
    private readonly experienceService: CandidateExperienceService,
    private readonly skillsService: CandidateSkillsService,
    private readonly certificatesService: CandidateCertificatesService,
  ) {}

  // ─── Profile ────────────────────────────────────────────────

  @ApiTags('Candidates - Profile')
  @Get('profile')
  @ApiAuth()
  @ApiOperation({ summary: 'Lấy toàn bộ hồ sơ ứng viên' })
  @ApiResponse({ status: 200, description: 'Toàn bộ hồ sơ' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy hồ sơ ứng viên' })
  getProfile(@Req() req: Request) {
    const user = req.user as { id: number; candidateId?: number };
    return this.profileService.getProfile(user.id, user.candidateId);
  }

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
    return this.profileService.updateProfile(user.id, updateProfileDto);
  }

  @ApiTags('Candidates - Profile')
  @Post('cv')
  @ApiAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload CV (PDF) Ứng viên' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File CV dạng PDF',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 200, description: 'Upload CV thành công' })
  @ApiResponse({ status: 400, description: 'File không hợp lệ' })
  uploadCv(
    @Req() req: Request,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: 'pdf',
        })
        .addMaxSizeValidator({
          maxSize: 5 * 1024 * 1024, // 5MB limit
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        }),
    )
    file: Express.Multer.File,
  ) {
    const user = req.user as { id: number };
    return this.profileService.uploadCv(user.id, file);
  }

  @ApiTags('Candidates - Profile')
  @Post('avatar')
  @ApiAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload ảnh đại diện (Avatar) Ứng viên' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Ảnh đại diện (jpg, jpeg, png)',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 200, description: 'Upload avatar thành công' })
  @ApiResponse({ status: 400, description: 'File không hợp lệ' })
  uploadAvatar(
    @Req() req: Request,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /(jpg|jpeg|png)$/ })
        .addMaxSizeValidator({ maxSize: 5 * 1024 * 1024 })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
    )
    file: Express.Multer.File,
  ) {
    const user = req.user as { id: number };
    return this.profileService.uploadAvatar(user.id, file);
  }

  // ─── Work Experiences ───────────────────────────────────────

  @ApiTags('Candidates - Work Experiences')
  @Get('work-experiences')
  @ApiAuth()
  @ApiOperation({ summary: 'Lấy danh sách kinh nghiệm làm việc' })
  @ApiResponse({ status: 200, description: 'Danh sách kinh nghiệm làm việc' })
  getWorkExperiences(@Req() req: Request) {
    const user = req.user as { id: number };
    return this.experienceService.getWorkExperiences(user.id);
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
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWorkExperienceDto,
  ) {
    const user = req.user as { id: number };
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
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const user = req.user as { id: number };
    return this.experienceService.deleteWorkExperience(user.id, id);
  }

  // ─── Educations ─────────────────────────────────────────────

  @ApiTags('Candidates - Educations')
  @Get('educations')
  @ApiAuth()
  @ApiOperation({ summary: 'Lấy danh sách học vấn' })
  @ApiResponse({ status: 200, description: 'Danh sách học vấn' })
  getEducations(@Req() req: Request) {
    const user = req.user as { id: number };
    return this.experienceService.getEducations(user.id);
  }

  @ApiTags('Candidates - Educations')
  @Post('educations')
  @ApiAuth()
  @ApiOperation({ summary: 'Thêm học vấn mới' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy hồ sơ ứng viên' })
  createEducation(@Req() req: Request, @Body() dto: CreateEducationDto) {
    const user = req.user as { id: number };
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
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEducationDto,
  ) {
    const user = req.user as { id: number };
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
  deleteEducation(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    const user = req.user as { id: number };
    return this.experienceService.deleteEducation(user.id, id);
  }

  // ─── Projects ─────────────────────────────────────────────

  @ApiTags('Candidates - Projects')
  @Get('projects')
  @ApiAuth()
  @ApiOperation({ summary: 'Lấy danh sách dự án' })
  @ApiResponse({ status: 200, description: 'Danh sách dự án' })
  getProjects(@Req() req: Request) {
    const user = req.user as { id: number };
    return this.experienceService.getProjects(user.id);
  }

  @ApiTags('Candidates - Projects')
  @Post('projects')
  @ApiAuth()
  @ApiOperation({ summary: 'Thêm dự án mới' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy hồ sơ ứng viên' })
  createProject(@Req() req: Request, @Body() dto: CreateProjectDto) {
    const user = req.user as { id: number };
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
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProjectDto,
  ) {
    const user = req.user as { id: number };
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
  deleteProject(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    const user = req.user as { id: number };
    return this.experienceService.deleteProject(user.id, id);
  }

  // ─── Certificates ───────────────────────────────────────────

  @ApiTags('Candidates - Certificates')
  @Get('certificates')
  @ApiAuth()
  @ApiOperation({ summary: 'Lấy danh sách chứng chỉ' })
  @ApiResponse({ status: 200, description: 'Danh sách chứng chỉ' })
  getCertificates(@Req() req: Request) {
    const user = req.user as { id: number };
    return this.certificatesService.getCertificates(user.id);
  }

  @ApiTags('Candidates - Certificates')
  @Post('certificates')
  @ApiAuth()
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Thêm chứng chỉ mới (có thể upload ảnh)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        image: {
          type: 'string',
          format: 'binary',
          description: 'Ảnh chứng chỉ (jpeg, png)',
        },
      },
      required: ['name'],
    },
  })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy hồ sơ ứng viên' })
  createCertificate(
    @Req() req: Request,
    @Body() dto: CreateCertificateDto,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /(jpg|jpeg|png)$/ })
        .addMaxSizeValidator({ maxSize: 5 * 1024 * 1024 })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          fileIsRequired: false,
        }),
    )
    file?: Express.Multer.File,
  ) {
    const user = req.user as { id: number };
    return this.certificatesService.createCertificate(user.id, dto, file);
  }

  @ApiTags('Candidates - Certificates')
  @Put('certificates/:id')
  @ApiAuth()
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Cập nhật chứng chỉ (có thể upload lại ảnh)' })
  @ApiParam({ name: 'id', description: 'ID chứng chỉ' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        image: {
          type: 'string',
          format: 'binary',
          description: 'Ảnh chứng chỉ (jpeg, png)',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 403, description: 'Không có quyền sửa' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy chứng chỉ' })
  updateCertificate(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCertificateDto,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /(jpg|jpeg|png)$/ })
        .addMaxSizeValidator({ maxSize: 5 * 1024 * 1024 })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          fileIsRequired: false,
        }),
    )
    file?: Express.Multer.File,
  ) {
    const user = req.user as { id: number };
    return this.certificatesService.updateCertificate(user.id, id, dto, file);
  }

  @ApiTags('Candidates - Certificates')
  @Delete('certificates/:id')
  @ApiAuth()
  @ApiOperation({ summary: 'Xóa chứng chỉ' })
  @ApiParam({ name: 'id', description: 'ID chứng chỉ' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  @ApiResponse({ status: 403, description: 'Không có quyền xóa' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy chứng chỉ' })
  deleteCertificate(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const user = req.user as { id: number };
    return this.certificatesService.deleteCertificate(user.id, id);
  }

  // ─── Skills ─────────────────────────────────────────────────

  @ApiTags('Candidates - Skills')
  @Get('skills')
  @ApiAuth()
  @ApiOperation({ summary: 'Lấy danh sách skills của mình' })
  @ApiResponse({ status: 200, description: 'Danh sách skills' })
  getSkills(@Req() req: Request) {
    const user = req.user as { id: number };
    return this.skillsService.getSkills(user.id);
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
    return this.skillsService.addSkills(user.id, dto);
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
    return this.skillsService.deleteSkill(user.id, id);
  }

  // ─── Job Categories ─────────────────────────────────────────

  @ApiTags('Candidates - Job Categories')
  @Get('job-categories')
  @ApiAuth()
  @ApiOperation({ summary: 'Lấy danh sách các ngành nghề ứng viên đã chọn' })
  @ApiResponse({ status: 200, description: 'Danh sách ngành nghề' })
  getJobCategories(@Req() req: Request) {
    const user = req.user as { id: number };
    return this.skillsService.getJobCategories(user.id);
  }

  @ApiTags('Candidates - Job Categories')
  @Post('job-categories')
  @ApiAuth()
  @ApiOperation({
    summary: 'Thêm ngành nghề cho ứng viên',
  })
  @ApiResponse({ status: 201, description: 'Thêm thành công' })
  addJobCategories(@Req() req: Request, @Body() dto: UpdateJobCategoriesDto) {
    const user = req.user as { id: number };
    return this.skillsService.addJobCategories(user.id, dto);
  }

  @ApiTags('Candidates - Job Categories')
  @Delete('job-categories/:id')
  @ApiAuth()
  @ApiOperation({
    summary: 'Xóa 1 ngành nghề (truyền ID của bảng candidate_job_category)',
  })
  @ApiParam({ name: 'id', description: 'ID' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  deleteJobCategory(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const user = req.user as { id: number };
    return this.skillsService.deleteJobCategory(user.id, id);
  }

  // ─── Job Types ──────────────────────────────────────────────

  @ApiTags('Candidates - Job Types')
  @Get('job-types')
  @ApiOperation({ summary: 'Lấy filter hình thức làm việc' })
  @ApiResponse({ status: 200, description: 'Danh sách hình thức làm việc' })
  getJobTypes() {
    return this.skillsService.getJobTypes();
  }
}
