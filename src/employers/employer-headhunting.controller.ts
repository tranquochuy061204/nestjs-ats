import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiAuth } from '../common/decorators/api-auth.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { EmployerHeadhuntingService } from './employer-headhunting.service';
import { CreateJobInvitationDto } from '../jobs/dto/create-job-invitation.dto';
import { HeadhuntingFilterDto } from './dto/headhunting-filter.dto';
import { SaveCandidateDto } from './dto/save-candidate.dto';

@ApiTags('Employers - Headhunting')
@Controller('employers/headhunting')
export class EmployerHeadhuntingController {
  constructor(
    private readonly headhuntingService: EmployerHeadhuntingService,
  ) {}

  @Get('jobs/:jobId/suggested-candidates')
  @ApiAuth()
  @ApiOperation({
    summary: 'Lấy danh sách ứng viên đề xuất tự động cho một công việc',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách 50 ứng viên phù hợp nhất',
  })
  getSuggestedCandidates(
    @CurrentUser() user: { id: number },
    @Param('jobId', ParseIntPipe) jobId: number,
  ) {
    return this.headhuntingService.getSuggestedCandidates(user.id, jobId);
  }

  @Get('candidates')
  @ApiAuth()
  @ApiOperation({ summary: 'Tìm kiếm ứng viên tự do (Headhunting Search)' })
  @ApiResponse({ status: 200, description: 'Danh sách ứng viên theo bộ lọc' })
  searchCandidates(
    @CurrentUser() user: { id: number },
    @Query() filter: HeadhuntingFilterDto,
  ) {
    return this.headhuntingService.searchCandidates(user.id, filter);
  }

  @Get('candidates/:id')
  @ApiAuth()
  @ApiOperation({ summary: 'Xem chi tiết hồ sơ ứng viên (VIP - Không che)' })
  @ApiResponse({ status: 200, description: 'Full Profile Ứng viên' })
  getCandidateDetail(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.headhuntingService.getCandidateDetail(user.id, id);
  }

  @Get('saved-candidates')
  @ApiAuth()
  @ApiOperation({ summary: 'Lấy danh sách ứng viên trong Talent Pool' })
  @ApiResponse({ status: 200, description: 'Danh sách ứng viên đã lưu' })
  getSavedCandidates(@CurrentUser() user: { id: number }) {
    return this.headhuntingService.getSavedCandidates(user.id);
  }

  @Post('saved-candidates/:candidateId')
  @ApiAuth()
  @ApiOperation({ summary: 'Lưu ứng viên vào Talent Pool' })
  @ApiResponse({ status: 201, description: 'Lưu thành công' })
  saveCandidate(
    @CurrentUser() user: { id: number },
    @Param('candidateId', ParseIntPipe) candidateId: number,
    @Body() dto: SaveCandidateDto,
  ) {
    return this.headhuntingService.saveCandidate(user.id, candidateId, dto);
  }

  @Delete('saved-candidates/:candidateId')
  @ApiAuth()
  @ApiOperation({ summary: 'Xóa ứng viên khỏi Talent Pool' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  unsaveCandidate(
    @CurrentUser() user: { id: number },
    @Param('candidateId', ParseIntPipe) candidateId: number,
  ) {
    return this.headhuntingService.unsaveCandidate(user.id, candidateId);
  }

  @Post('invitations')
  @ApiAuth()
  @ApiOperation({ summary: 'Gửi thư mời ứng tuyển cho ứng viên' })
  @ApiResponse({ status: 201, description: 'Gửi thành công' })
  sendInvitation(
    @CurrentUser() user: { id: number },
    @Body() dto: CreateJobInvitationDto,
  ) {
    return this.headhuntingService.sendJobInvitation(user.id, dto);
  }

  @Get('invitations')
  @ApiAuth()
  @ApiOperation({ summary: 'Lấy danh sách thư mời đã gửi' })
  @ApiResponse({ status: 200, description: 'Danh sách thư mời' })
  getSentInvitations(@CurrentUser() user: { id: number }) {
    return this.headhuntingService.getSentInvitations(user.id);
  }
}
