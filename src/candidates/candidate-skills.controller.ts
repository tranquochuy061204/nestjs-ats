import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseInterceptors,
  UploadedFile,
  ParseFilePipeBuilder,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
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
import { CandidateSkillsService } from './services/candidate-skills.service';
import { CandidateCertificatesService } from './services/candidate-certificates.service';
import { CreateCertificateDto } from './dto/create-certificate.dto';
import { UpdateCertificateDto } from './dto/update-certificate.dto';
import { AddSkillsDto } from './dto/add-skills.dto';
import { UpdateJobCategoriesDto } from './dto/update-job-categories.dto';
import { FILE_SIZES } from '../common/constants/storage-paths.constant';

@Controller('candidates')
export class CandidateSkillsController {
  constructor(
    private readonly skillsService: CandidateSkillsService,
    private readonly certificatesService: CandidateCertificatesService,
  ) {}

  // ─── Certificates ───────────────────────────────────────────

  @ApiTags('Candidates - Certificates')
  @Get('certificates')
  @ApiAuth()
  @ApiOperation({ summary: 'Lấy danh sách chứng chỉ' })
  @ApiResponse({ status: 200, description: 'Danh sách chứng chỉ' })
  getCertificates(@CurrentUser() user: { id: number }) {
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
    @CurrentUser() user: { id: number },
    @Body() dto: CreateCertificateDto,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /(jpg|jpeg|png)$/ })
        .addMaxSizeValidator({ maxSize: FILE_SIZES.MAX_IMAGE_SIZE })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          fileIsRequired: false,
        }),
    )
    file?: Express.Multer.File,
  ) {
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
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCertificateDto,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /(jpg|jpeg|png)$/ })
        .addMaxSizeValidator({ maxSize: FILE_SIZES.MAX_IMAGE_SIZE })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          fileIsRequired: false,
        }),
    )
    file?: Express.Multer.File,
  ) {
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
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.certificatesService.deleteCertificate(user.id, id);
  }

  // ─── Skills ─────────────────────────────────────────────────

  @ApiTags('Candidates - Skills')
  @Get('skills')
  @ApiAuth()
  @ApiOperation({ summary: 'Lấy danh sách skills của mình' })
  @ApiResponse({ status: 200, description: 'Danh sách skills' })
  getSkills(@CurrentUser() user: { id: number }) {
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
  addSkills(@CurrentUser() user: { id: number }, @Body() dto: AddSkillsDto) {
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
  deleteSkill(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.skillsService.deleteSkill(user.id, id);
  }

  // ─── Job Categories ─────────────────────────────────────────

  @ApiTags('Candidates - Job Categories')
  @Get('job-categories')
  @ApiAuth()
  @ApiOperation({ summary: 'Lấy danh sách các ngành nghề ứng viên đã chọn' })
  @ApiResponse({ status: 200, description: 'Danh sách ngành nghề' })
  getJobCategories(@CurrentUser() user: { id: number }) {
    return this.skillsService.getJobCategories(user.id);
  }

  @ApiTags('Candidates - Job Categories')
  @Post('job-categories')
  @ApiAuth()
  @ApiOperation({
    summary: 'Thêm ngành nghề cho ứng viên',
  })
  @ApiResponse({ status: 201, description: 'Thêm thành công' })
  addJobCategories(
    @CurrentUser() user: { id: number },
    @Body() dto: UpdateJobCategoriesDto,
  ) {
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
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
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
