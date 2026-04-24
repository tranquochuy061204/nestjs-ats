import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiAuth } from '../common/decorators/api-auth.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CandidateSearchService } from './services/candidate-search.service';
import { CandidateFilterDto } from './dto/candidate-filter.dto';

/**
 * Endpoint tìm kiếm ứng viên nâng cao — dành cho Employer.
 * Chỉ trả về candidate có isPublic = true.
 * Thông tin nhạy cảm (phone, cvUrl…) được ẩn tự động.
 */
@ApiTags('Candidates - Search')
@Controller('candidates/search')
export class CandidateSearchController {
  constructor(
    private readonly candidateSearchService: CandidateSearchService,
  ) {}

  @Get()
  @ApiAuth(UserRole.EMPLOYER)
  @ApiOperation({
    summary: 'Tìm kiếm ứng viên đa yếu tố (Dành cho Nhà tuyển dụng)',
    description: `
Tìm kiếm ứng viên với nhiều bộ lọc kết hợp:
- **keyword**: Tìm theo tên / vị trí mong muốn
- **provinceId**: Lọc theo tỉnh/thành phố
- **jobTypeId**: Lọc theo hình thức làm việc mong muốn
- **skillIds**: Lọc theo skill (OR — có ít nhất 1 skill)
- **categoryIds**: Lọc theo ngành nghề quan tâm (OR)
- **salaryMin / salaryMax**: Overlap với khoảng lương kỳ vọng của ứng viên
- **minExperience**: Số năm kinh nghiệm tối thiểu
- **sortBy / sortOrder**: Sắp xếp kết quả
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách ứng viên phù hợp (đã ẩn thông tin nhạy cảm)',
  })
  searchCandidates(@Query() filterDto: CandidateFilterDto) {
    return this.candidateSearchService.searchCandidates(filterDto);
  }
}
