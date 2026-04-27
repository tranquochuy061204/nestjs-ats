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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ApiAuth } from '../../common/decorators/api-auth.decorator';
import { CandidateEducationService } from '../services/candidate-education.service';
import { CreateEducationDto } from '../dto/create-education.dto';
import { UpdateEducationDto } from '../dto/update-education.dto';

@ApiTags('Candidates - Educations')
@Controller('candidates')
export class CandidateEducationController {
  constructor(private readonly educationService: CandidateEducationService) {}

  @Get('educations')
  @ApiAuth()
  @ApiOperation({ summary: 'Lấy danh sách học vấn' })
  @ApiResponse({ status: 200, description: 'Danh sách học vấn' })
  getEducations(@CurrentUser() user: { id: number }) {
    return this.educationService.getEducations(user.id);
  }

  @Post('educations')
  @ApiAuth()
  @ApiOperation({ summary: 'Thêm học vấn mới' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy hồ sơ ứng viên' })
  createEducation(
    @CurrentUser() user: { id: number },
    @Body() dto: CreateEducationDto,
  ) {
    return this.educationService.createEducation(user.id, dto);
  }

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
    return this.educationService.updateEducation(user.id, id, dto);
  }

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
    return this.educationService.deleteEducation(user.id, id);
  }
}
