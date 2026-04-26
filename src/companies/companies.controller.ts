import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseFilePipeBuilder,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { ApiAuth } from '../common/decorators/api-auth.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CompaniesService } from './companies.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { PublicJobsService } from '../jobs/services/public-jobs.service';
import { JobFilterDto } from '../jobs/dto/job-filter.dto';
import { Query } from '@nestjs/common';

@ApiTags('Companies - Quản lý hồ sơ doanh nghiệp')
@Controller('companies')
export class CompaniesController {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly publicJobsService: PublicJobsService,
  ) {}

  @Put('profile')
  @ApiAuth()
  @ApiOperation({ summary: 'Cập nhật thông tin công ty' })
  updateCompanyProfile(@Req() req: Request, @Body() dto: UpdateCompanyDto) {
    const user = req.user as { id: number };
    return this.companiesService.updateCompanyProfile(user.id, dto);
  }

  @Post('logo')
  @ApiAuth(UserRole.EMPLOYER)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload Logo công ty' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  uploadLogo(
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
    return this.companiesService.uploadLogo(user.id, file);
  }

  @Post('banner')
  @ApiAuth(UserRole.EMPLOYER)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload Banner công ty' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  uploadBanner(
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
    return this.companiesService.uploadBanner(user.id, file);
  }

  @Post('images')
  @ApiAuth(UserRole.EMPLOYER)
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      fileFilter: (req, file, cb) => {
        // Validate array of files
        if (!file.mimetype.match(/\/(jpg|jpeg|png)$/)) {
          return cb(
            new BadRequestException('Only image files are allowed!'),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload nhiều hình ảnh làm việc (tối đa 10 file)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  uploadCompanyImages(
    @Req() req: Request,
    @UploadedFiles()
    files: Express.Multer.File[],
  ) {
    const user = req.user as { id: number };
    return this.companiesService.uploadCompanyImages(user.id, files);
  }

  @Delete('images/:id')
  @ApiAuth(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Xóa hình ảnh làm việc' })
  deleteCompanyImage(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const user = req.user as { id: number };
    return this.companiesService.deleteCompanyImage(user.id, id);
  }

  @Post('business-license')
  @ApiAuth(UserRole.EMPLOYER)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload Giấy phép kinh doanh để xác thực công ty' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  uploadBusinessLicense(
    @Req() req: Request,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /(jpg|jpeg|png|pdf)$/ })
        .addMaxSizeValidator({ maxSize: 10 * 1024 * 1024 })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
    )
    file: Express.Multer.File,
  ) {
    const user = req.user as { id: number };
    return this.companiesService.uploadBusinessLicense(user.id, file);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Xem chi tiết thông tin công ty qua Slug (Public)' })
  @ApiResponse({ status: 200, description: 'Thông tin công ty và gallery' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy công ty' })
  getCompanyPublicBySlug(@Param('slug') slug: string) {
    return this.companiesService.getCompanyPublicBySlug(slug);
  }

  @Get('slug/:slug/jobs')
  @ApiOperation({ summary: 'Lấy danh sách job public của công ty qua Slug' })
  @ApiResponse({ status: 200, description: 'Danh sách công việc' })
  getCompanyJobsBySlug(
    @Param('slug') slug: string,
    @Query() filterDto: JobFilterDto,
  ) {
    return this.publicJobsService.getCompanyJobsBySlug(slug, filterDto);
  }
}
