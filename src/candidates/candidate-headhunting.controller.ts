import { Controller, Get, Post, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiAuth } from '../common/decorators/api-auth.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CandidateHeadhuntingService } from './services/candidate-headhunting.service';

@ApiTags('Candidates - Headhunting')
@Controller('candidates/headhunting')
export class CandidateHeadhuntingController {
  constructor(
    private readonly headhuntingService: CandidateHeadhuntingService,
  ) {}

  @Get('invitations')
  @ApiAuth()
  @ApiOperation({ summary: 'Lấy danh sách thư mời nhận việc từ NTD' })
  @ApiResponse({ status: 200, description: 'Danh sách thư mời' })
  getMyInvitations(@CurrentUser() user: { id: number }) {
    return this.headhuntingService.getMyInvitations(user.id);
  }

  @Post('invitations/:id/accept')
  @ApiAuth()
  @ApiOperation({ summary: 'Chấp nhận thư mời (Tự động tạo đơn ứng tuyển)' })
  @ApiResponse({ status: 200, description: 'Chấp nhận thành công' })
  acceptInvitation(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.headhuntingService.acceptInvitation(user.id, id);
  }

  @Post('invitations/:id/decline')
  @ApiAuth()
  @ApiOperation({ summary: 'Từ chối thư mời' })
  @ApiResponse({ status: 200, description: 'Từ chối thành công' })
  declineInvitation(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.headhuntingService.declineInvitation(user.id, id);
  }
}
