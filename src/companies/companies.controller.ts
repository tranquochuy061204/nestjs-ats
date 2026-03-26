import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ApiAuth } from '../common/decorators/api-auth.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CompaniesService } from './companies.service';
import { UpdateCompanyDto } from './dto/update-company.dto';

@ApiTags('Companies - Quản lý hồ sơ doanh nghiệp')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

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
}
