import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  ParseFilePipeBuilder,
  Post,
  Put,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ApiAuth } from '../common/decorators/api-auth.decorator';
import { UserRole } from '../users/entities/user.entity';
import { EmployersService } from './employers.service';
import { SetupCompanyDto } from './dto/setup-company.dto';
import { UpdateEmployerProfileDto } from './dto/update-employer-profile.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { ParseIntPipe, Param } from '@nestjs/common';

@ApiTags('Employers - Quản lý HR')
@Controller('employers')
export class EmployersController {
  constructor(private readonly employersService: EmployersService) {}

  @Post('setup-company')
  @ApiAuth(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Khởi tạo công ty (Dành cho HR mới)' })
  setupCompany(@Req() req: Request, @Body() dto: SetupCompanyDto) {
    const user = req.user as { id: number };
    return this.employersService.setupCompany(user.id, dto);
  }

  @Get('profile')
  @ApiAuth(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Lấy thông tin cá nhân HR hiện tại' })
  getProfile(@Req() req: Request) {
    const user = req.user as { id: number };
    return this.employersService.getProfile(user.id);
  }

  @Put('profile')
  @ApiAuth(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Cập nhật thông tin cá nhân HR' })
  updateProfile(@Req() req: Request, @Body() dto: UpdateEmployerProfileDto) {
    const user = req.user as { id: number };
    return this.employersService.updateProfile(user.id, dto);
  }

  @Post('avatar')
  @ApiAuth(UserRole.EMPLOYER)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload ảnh đại diện HR' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
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
    return this.employersService.uploadAvatar(user.id, file);
  }

  // --- QUẢN LÝ THÀNH VIÊN CÔNG TY ---

  @Post('members')
  @ApiAuth(UserRole.EMPLOYER)
  @ApiOperation({
    summary: 'Thêm thành viên mới vào công ty (Chỉ dành cho Admin công ty)',
  })
  addMember(@Req() req: Request, @Body() dto: AddMemberDto) {
    const user = req.user as { id: number };
    return this.employersService.addMember(user.id, dto);
  }

  @Get('members')
  @ApiAuth(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Lấy danh sách thành viên trong công ty' })
  getMembers(@Req() req: Request) {
    const user = req.user as { id: number };
    return this.employersService.getCompanyMembers(user.id);
  }

  @Delete('members/:id')
  @ApiAuth(UserRole.EMPLOYER)
  @ApiOperation({ summary: 'Gỡ thành viên khỏi công ty' })
  removeMember(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    const user = req.user as { id: number };
    return this.employersService.removeMember(user.id, id);
  }
}
