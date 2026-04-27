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
import { CandidateProjectService } from '../services/candidate-project.service';
import { CreateProjectDto } from '../dto/create-project.dto';
import { UpdateProjectDto } from '../dto/update-project.dto';

@ApiTags('Candidates - Projects')
@Controller('candidates')
export class CandidateProjectController {
  constructor(private readonly projectService: CandidateProjectService) {}

  @Get('projects')
  @ApiAuth()
  @ApiOperation({ summary: 'Lấy danh sách dự án' })
  @ApiResponse({ status: 200, description: 'Danh sách dự án' })
  getProjects(@CurrentUser() user: { id: number }) {
    return this.projectService.getProjects(user.id);
  }

  @Post('projects')
  @ApiAuth()
  @ApiOperation({ summary: 'Thêm dự án mới' })
  @ApiResponse({ status: 201, description: 'Tạo thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy hồ sơ ứng viên' })
  createProject(
    @CurrentUser() user: { id: number },
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectService.createProject(user.id, dto);
  }

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
    return this.projectService.updateProject(user.id, id, dto);
  }

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
    return this.projectService.deleteProject(user.id, id);
  }
}
