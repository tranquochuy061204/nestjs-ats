import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CandidateEntity } from '../../candidates/entities/candidate.entity';
import { CandidateFilterDto } from '../../candidates/dto/candidate-filter.dto';
import { EmployerEntity } from '../entities/employer.entity';
import { JobEntity } from '../../jobs/entities/job.entity';

// New services
import { EmployerContactUnlockService } from './employer-contact-unlock.service';
import { CandidateSearchService } from '../../candidates/services/candidate-search.service';
import { CandidateSortBy } from '../../common/enums/sort-order.enum';

@Injectable()
export class EmployerCandidateMatchingService {
  constructor(
    @InjectRepository(CandidateEntity)
    private readonly candidateRepo: Repository<CandidateEntity>,
    @InjectRepository(EmployerEntity)
    private readonly employerRepo: Repository<EmployerEntity>,
    @InjectRepository(JobEntity)
    private readonly jobRepo: Repository<JobEntity>,
    private readonly unlockService: EmployerContactUnlockService,
    private readonly searchService: CandidateSearchService,
  ) {}


  async getSuggestedCandidates(
    employerUserId: number,
    jobId: number,
    page: number = 1,
    limit: number = 20,
  ) {
    const employer = await this.findEmployerWithCompany(employerUserId);

    // Kiểm tra quyền sở hữu tin tuyển dụng
    const job = await this.jobRepo.findOne({
      where: { id: jobId, companyId: employer.companyId },
    });

    if (!job) {
      throw new NotFoundException(
        'Tin tuyển dụng không tồn tại hoặc không thuộc công ty của bạn',
      );
    }

    // searchCandidates already handles jobId fetching and scoring logic
    const result = await this.searchService.searchCandidates(
      {
        page,
        limit,
        jobId,
        sortBy: CandidateSortBy.RELEVANCE,
      } as unknown as CandidateFilterDto,
      employerUserId,
    );

    return result;
  }

  private async findEmployerWithCompany(
    employerUserId: number,
  ): Promise<EmployerEntity & { companyId: number }> {
    const employer = await this.employerRepo.findOne({
      where: { userId: employerUserId },
      relations: ['company'],
    });

    if (!employer || !employer.companyId) {
      throw new BadRequestException(
        'Bạn chưa có công ty hoặc chưa được duyệt để thực hiện chức năng này',
      );
    }
    return employer as EmployerEntity & { companyId: number };
  }
}
