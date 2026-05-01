import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiAuth } from '../common/decorators/api-auth.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CandidateSearchService } from '../candidates/services/candidate-search.service';
import { CandidateFilterDto } from '../candidates/dto/candidate-filter.dto';
import { CreateJobInvitationDto } from '../jobs/dto/create-job-invitation.dto';
import { SaveCandidateDto } from './dto/save-candidate.dto';
import { SuggestionFilterDto } from './dto/suggestion-filter.dto';
import { UserRole } from '../users/entities/user.entity';

// New services
import { EmployerCandidateMatchingService } from './services/employer-candidate-matching.service';
import { EmployerContactUnlockService } from './services/employer-contact-unlock.service';
import { EmployerTalentPoolService } from './services/employer-talent-pool.service';
import { EmployerInvitationService } from './services/employer-invitation.service';
import { EmployersService } from './employers.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@ApiTags('Employers - Headhunting')
@ApiAuth(UserRole.EMPLOYER)
@Controller('employers/headhunting')
export class EmployerHeadhuntingController {
  constructor(
    private readonly candidateSearchService: CandidateSearchService,
    private readonly matchingService: EmployerCandidateMatchingService,
    private readonly unlockService: EmployerContactUnlockService,
    private readonly talentPoolService: EmployerTalentPoolService,
    private readonly invitationService: EmployerInvitationService,
    private readonly employersService: EmployersService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  @Get('quota')
  @ApiOperation({
    summary: 'Lấy thông tin quota xem hồ sơ Headhunting của tháng hiện tại',
  })
  @ApiResponse({ status: 200, description: 'Thông tin quota' })
  getQuota(@CurrentUser() user: { id: number }) {
    return this.unlockService.getQuota(user.id);
  }

  @Get('unlocked-candidates')
  @ApiOperation({
    summary: 'Lấy danh sách các ứng viên đã mở khoá thông tin liên hệ',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách ứng viên đã mở khoá (có pagination)',
  })
  getUnlockedCandidates(
    @CurrentUser() user: { id: number },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.unlockService.getUnlockedCandidates(
      user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Get('jobs/:jobId/suggested-candidates')
  @ApiOperation({
    summary: 'Lấy danh sách ứng viên đề xuất tự động cho một công việc',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách ứng viên phù hợp nhất (có pagination)',
  })
  getSuggestedCandidates(
    @CurrentUser() user: { id: number },
    @Param('jobId', ParseIntPipe) jobId: number,
    @Query() filterDto: SuggestionFilterDto,
  ) {
    return this.matchingService.getSuggestedCandidates(
      user.id,
      jobId,
      filterDto.page,
      filterDto.limit,
    );
  }

  @Get('candidates')
  @ApiOperation({
    summary: 'Tìm kiếm ứng viên đa yếu tố (Headhunting Search)',
    description: `
Tìm kiếm ứng viên với nhiều bộ lọc kết hợp:
- **keyword**: Tìm theo tên / vị trí mong muốn
- **provinceId**: Lọc theo tỉnh/thành phố
- **jobTypeId**: Lọc theo hình thức làm việc
- **skillIds**: Lọc theo skill (OR — có ít nhất 1 skill)
- **categoryIds**: Lọc theo ngành nghề (OR)
- **salaryMin / salaryMax**: Overlap với kỳ vọng lương của ứng viên
- **minExperience**: Số năm kinh nghiệm tối thiểu

Thông tin nhạy cảm (phone, cvUrl, social links) được ẩn tự động.
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách ứng viên phù hợp (đã ẩn thông tin nhạy cảm)',
  })
  async searchCandidates(
    @Query() filterDto: CandidateFilterDto,
    @CurrentUser() user: { id: number },
  ) {
    const hasPremiumFilters =
      filterDto.provinceId ||
      filterDto.jobTypeId ||
      (filterDto.skillIds && filterDto.skillIds.length > 0) ||
      (filterDto.categoryIds && filterDto.categoryIds.length > 0) ||
      filterDto.salaryMin !== undefined ||
      filterDto.salaryMax !== undefined ||
      filterDto.minExperience !== undefined;

    if (hasPremiumFilters) {
      const employer = await this.employersService.getProfile(user.id);
      if (employer?.companyId) {
        const canUse = await this.subscriptionsService.canUseFeature(
          employer.companyId,
          'canUsePremiumFilters',
        );
        if (!canUse) {
          throw new ForbiddenException(
            'Vui lòng nâng cấp gói VIP để sử dụng bộ lọc nâng cao',
          );
        }
      }
    }

    return this.candidateSearchService.searchCandidates(filterDto, user.id);
  }

  @Get('candidates/:id')
  @ApiOperation({
    summary: 'Xem chi tiết hồ sơ ứng viên (Che nếu chưa mở khóa)',
  })
  @ApiResponse({ status: 200, description: 'Profile Ứng viên' })
  getCandidateDetail(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.unlockService.getCandidateDetail(user.id, id);
  }

  @Post('candidates/:id/unlock')
  @ApiOperation({ summary: 'Mở khóa thông tin liên hệ ứng viên' })
  @ApiResponse({
    status: 200,
    description: 'Mở khóa thành công (trả về full profile)',
  })
  unlockCandidateContact(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.unlockService.unlockCandidateContact(user.id, id);
  }

  @Get('saved-candidates')
  @ApiOperation({ summary: 'Lấy danh sách ứng viên trong Talent Pool' })
  @ApiResponse({ status: 200, description: 'Danh sách ứng viên đã lưu' })
  getSavedCandidates(@CurrentUser() user: { id: number }) {
    return this.talentPoolService.getSavedCandidates(user.id);
  }

  @Post('saved-candidates/:candidateId')
  @ApiOperation({ summary: 'Lưu ứng viên vào Talent Pool' })
  @ApiResponse({ status: 201, description: 'Lưu thành công' })
  async saveCandidate(
    @CurrentUser() user: { id: number },
    @Param('candidateId', ParseIntPipe) candidateId: number,
    @Body() dto: SaveCandidateDto,
  ) {
    const employer = await this.employersService.getProfile(user.id);
    if (employer?.companyId) {
      const canUse = await this.subscriptionsService.canUseFeature(
        employer.companyId,
        'canHeadhuntSaveAndInvite',
      );
      if (!canUse) {
        throw new ForbiddenException(
          'Vui lòng nâng cấp gói VIP để lưu ứng viên',
        );
      }
    }
    return this.talentPoolService.saveCandidate(user.id, candidateId, dto);
  }

  @Delete('saved-candidates/:candidateId')
  @ApiOperation({ summary: 'Xóa ứng viên khỏi Talent Pool' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  unsaveCandidate(
    @CurrentUser() user: { id: number },
    @Param('candidateId', ParseIntPipe) candidateId: number,
  ) {
    return this.talentPoolService.unsaveCandidate(user.id, candidateId);
  }

  @Post('invitations')
  @ApiOperation({ summary: 'Gửi thư mời ứng tuyển cho ứng viên' })
  @ApiResponse({ status: 201, description: 'Gửi thành công' })
  async sendInvitation(
    @CurrentUser() user: { id: number },
    @Body() dto: CreateJobInvitationDto,
  ) {
    const employer = await this.employersService.getProfile(user.id);
    if (employer?.companyId) {
      const canUse = await this.subscriptionsService.canUseFeature(
        employer.companyId,
        'canHeadhuntSaveAndInvite',
      );
      if (!canUse) {
        throw new ForbiddenException(
          'Vui lòng nâng cấp gói VIP để gửi thư mời',
        );
      }
    }
    return this.invitationService.sendJobInvitation(user.id, dto);
  }

  @Get('invitations')
  @ApiOperation({ summary: 'Lấy danh sách thư mời đã gửi' })
  @ApiResponse({ status: 200, description: 'Danh sách thư mời' })
  getSentInvitations(@CurrentUser() user: { id: number }) {
    return this.invitationService.getSentInvitations(user.id);
  }
}
