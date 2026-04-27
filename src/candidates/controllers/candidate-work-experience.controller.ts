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
import { CandidateWorkExperienceService } from '../services/candidate-work-experience.service';
import { CreateWorkExperienceDto } from '../dto/create-work-experience.dto';
import { UpdateWorkExperienceDto } from '../dto/update-work-experience.dto';

@ApiTags('Candidates - Work Experiences')
@Controller('candidates')
export class CandidateWorkExperienceController {
  constructor(
    private readonly workExperienceService: CandidateWorkExperienceService,
  ) {}

  @Get('work-experiences')
  @ApiAuth()
  @ApiOperation({ summary: 'Lấy danh sách kinh nghiệm làm việc' })
  @ApiResponse({ status: 200, description: 'Danh sách kinh nghiệm làm việc' })
  getWorkExperiences(@CurrentUser() user: { id: number }) {
    return this.workExperienceService.getWorkExperiences(user.id);
  }

  @Post('work-experiences')
  @ApiAuth()
  @ApiOperation({ summary: 'Thêm kinh nghiệm làm việc mới' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy hồ sơ ứng viên' })
  createWorkExperience(
    @CurrentUser() user: { id: number },
    @Body() dto: CreateWorkExperienceDto,
  ) {
    return this.workExperienceService.createWorkExperience(user.id, dto);
  }

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
    return this.workExperienceService.updateWorkExperience(user.id, id, dto);
  }

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
    return this.workExperienceService.deleteWorkExperience(user.id, id);
  }
}
