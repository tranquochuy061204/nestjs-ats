import {
  Body,
  Controller,
  Get,
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
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiAuth } from '../common/decorators/api-auth.decorator';
import { CandidateProfileService } from './services/candidate-profile.service';
import { CandidateCvParserService } from './services/candidate-cv-parser.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateVisibilityDto } from './dto/update-visibility.dto';
import { FILE_SIZES } from '../common/constants/storage-paths.constant';

@Controller('candidates')
export class CandidateProfileController {
  constructor(
    private readonly profileService: CandidateProfileService,
    private readonly cvParserService: CandidateCvParserService,
  ) {}

  @ApiTags('Candidates - Profile')
  @Get('profile')
  @ApiAuth()
  @ApiOperation({ summary: 'Lấy toàn bộ hồ sơ ứng viên' })
  @ApiResponse({ status: 200, description: 'Toàn bộ hồ sơ' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy hồ sơ ứng viên' })
  getProfile(@CurrentUser() user: { id: number; candidateId?: number }) {
    return this.profileService.getProfile(user.id, user.candidateId);
  }

  @ApiTags('Candidates - Profile')
  @Put('profile')
  @ApiAuth()
  @ApiOperation({ summary: 'Cập nhật hồ sơ ứng viên' })
  @ApiResponse({ status: 200, description: 'Cập nhật hồ sơ thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy hồ sơ ứng viên' })
  updateProfile(
    @CurrentUser() user: { id: number; email: string; role: string },
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.profileService.updateProfile(user.id, updateProfileDto);
  }

  @ApiTags('Candidates - Profile')
  @Put('profile/visibility')
  @ApiAuth()
  @ApiOperation({
    summary: 'Bật/Tắt chế độ công khai hồ sơ cho Employer Headhunting',
  })
  @ApiResponse({ status: 200, description: 'Cập nhật trạng thái thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy hồ sơ ứng viên' })
  updateVisibility(
    @CurrentUser() user: { id: number },
    @Body() dto: UpdateVisibilityDto,
  ) {
    return this.profileService.updateVisibility(user.id, dto.isPublic);
  }

  @ApiTags('Candidates - Profile')
  @ApiAuth([], true)
  @Post('cv')
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
    @CurrentUser() user: { id: number },
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: 'pdf',
        })
        .addMaxSizeValidator({
          maxSize: FILE_SIZES.MAX_CV_SIZE,
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        }),
    )
    file: Express.Multer.File,
  ) {
    return this.profileService.uploadCv(user.id, file);
  }

  @ApiTags('Candidates - Profile')
  @Post('cv/parse')
  @ApiAuth()
  @ApiOperation({
    summary: '[AI] Parse CV → Tự động điền thông tin vào Profile',
    description:
      'Gọi Gemini AI đọc file CV đã upload và tự động điền: họ tên, SĐT, vị trí, bio, ' +
      'kinh nghiệm làm việc, học vấn, dự án, chứng chỉ và kỹ năng. ' +
      'Tính năng chỉ chạy khi người dùng chủ động bấm nút — KHÔNG tự động khi upload CV. ' +
      'Dữ liệu mới được THÊM VÀO, không xóa dữ liệu đã có.',
  })
  @ApiResponse({
    status: 200,
    description: 'Phân tích và cập nhật thành công',
  })
  @ApiResponse({
    status: 400,
    description: 'Chưa upload CV | File không đọc được | AI chưa cấu hình',
  })
  @ApiResponse({ status: 404, description: 'Hồ sơ ứng viên không tồn tại' })
  parseCvToProfile(@CurrentUser() user: { id: number }) {
    return this.cvParserService.parseAndApply(user.id);
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
    @CurrentUser() user: { id: number },
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /(jpg|jpeg|png)$/ })
        .addMaxSizeValidator({ maxSize: FILE_SIZES.MAX_IMAGE_SIZE })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
    )
    file: Express.Multer.File,
  ) {
    return this.profileService.uploadAvatar(user.id, file);
  }
}
