import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  JobApplicationEntity,
  ApplicationStatus,
} from './entities/job-application.entity';
import { ApplicationStatusHistoryEntity } from './entities/application-status-history.entity';
import { CandidateEntity } from '../candidates/entities/candidate.entity';
import { JobEntity, JobStatus } from '../jobs/entities/job.entity';
import { ApplyJobDto } from './dto/apply-job.dto';
import { ApplicationFilterDto } from './dto/application-filter.dto';

@Injectable()
export class CandidateApplicationsService {
  private readonly logger = new Logger(CandidateApplicationsService.name);

  constructor(
    @InjectRepository(JobApplicationEntity)
    private readonly applicationRepo: Repository<JobApplicationEntity>,
    @InjectRepository(ApplicationStatusHistoryEntity)
    private readonly historyRepo: Repository<ApplicationStatusHistoryEntity>,
    @InjectRepository(CandidateEntity)
    private readonly candidateRepo: Repository<CandidateEntity>,
    @InjectRepository(JobEntity)
    private readonly jobRepo: Repository<JobEntity>,
  ) {}

  async apply(userId: number, jobId: number, dto: ApplyJobDto) {
    const candidate = await this.findCandidateByUserId(userId);

    // 1. Kiểm tra CV
    if (!candidate.cvUrl) {
      throw new BadRequestException(
        'Vui lòng tải lên CV trước khi ứng tuyển. Truy cập API POST /api/candidates/cv để upload.',
      );
    }

    // 2. Kiểm tra job
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException('Tin tuyển dụng không tồn tại');
    }

    if (job.status !== (JobStatus.PUBLISHED as string)) {
      throw new BadRequestException(
        'Tin tuyển dụng chưa được phát hành hoặc đã đóng',
      );
    }

    if (job.deadline && new Date(job.deadline) < new Date()) {
      throw new BadRequestException('Tin tuyển dụng đã hết hạn nộp hồ sơ');
    }

    // 3. Kiểm tra duplicate
    const existing = await this.applicationRepo.findOne({
      where: { jobId, candidateId: candidate.id },
    });

    if (existing) {
      if (existing.status === (ApplicationStatus.WITHDRAWN as string)) {
        existing.status = ApplicationStatus.APPLIED;
        existing.cvUrlSnapshot = candidate.cvUrl;
        existing.coverLetter = dto.coverLetter ?? null;
        existing.rejectionReason = null;
        existing.employerNote = null;
        await this.applicationRepo.save(existing);

        await this.logHistory(
          existing.id,
          ApplicationStatus.WITHDRAWN,
          ApplicationStatus.APPLIED,
          null,
          userId,
        );

        return {
          message:
            'Bạn đã từng ứng tuyển công việc này trước đó. Đơn ứng tuyển đã được gửi lại thành công.',
          applicationId: existing.id,
          reapplied: true,
        };
      }

      throw new ConflictException(
        'Bạn đã ứng tuyển công việc này rồi. Không thể nộp đơn trùng lặp.',
      );
    }

    // 4. Tạo đơn ứng tuyển mới
    const application = this.applicationRepo.create({
      jobId,
      candidateId: candidate.id,
      cvUrlSnapshot: candidate.cvUrl,
      coverLetter: dto.coverLetter,
      status: ApplicationStatus.APPLIED,
    });
    const saved = await this.applicationRepo.save(application);

    // 5. Log history
    await this.logHistory(
      saved.id,
      null,
      ApplicationStatus.APPLIED,
      null,
      userId,
    );

    return {
      message: 'Ứng tuyển thành công',
      applicationId: saved.id,
      reapplied: false,
    };
  }

  async getMyApplications(userId: number, filterDto: ApplicationFilterDto) {
    const candidate = await this.findCandidateByUserId(userId);
    const { page = 1, limit = 10, status } = filterDto;

    const qb = this.applicationRepo
      .createQueryBuilder('app')
      .leftJoinAndSelect('app.job', 'job')
      .leftJoinAndSelect('job.company', 'company')
      .leftJoinAndSelect('job.province', 'province')
      .leftJoinAndSelect('job.category', 'category')
      .where('app.candidateId = :candidateId', {
        candidateId: candidate.id,
      });

    if (status) {
      qb.andWhere('app.status = :status', { status });
    }

    qb.orderBy('app.appliedAt', 'DESC');

    const skip = (page - 1) * limit;
    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return { data, total, page, lastPage: Math.ceil(total / limit) };
  }

  async getMyApplicationDetail(userId: number, applicationId: number) {
    const candidate = await this.findCandidateByUserId(userId);

    const application = await this.applicationRepo.findOne({
      where: { id: applicationId, candidateId: candidate.id },
      relations: [
        'job',
        'job.company',
        'job.province',
        'job.category',
        'job.jobType',
        'statusHistory',
      ],
    });

    if (!application) {
      throw new NotFoundException('Đơn ứng tuyển không tồn tại');
    }

    return application;
  }

  async withdrawApplication(userId: number, applicationId: number) {
    const candidate = await this.findCandidateByUserId(userId);

    const application = await this.applicationRepo.findOne({
      where: { id: applicationId, candidateId: candidate.id },
    });

    if (!application) {
      throw new NotFoundException('Đơn ứng tuyển không tồn tại');
    }

    if (application.status === (ApplicationStatus.WITHDRAWN as string)) {
      throw new BadRequestException('Đơn ứng tuyển đã được rút trước đó');
    }

    if (application.status === (ApplicationStatus.OFFER as string)) {
      throw new BadRequestException(
        'Không thể rút đơn khi đã nhận đề nghị việc làm. Vui lòng liên hệ nhà tuyển dụng.',
      );
    }

    const oldStatus = application.status;
    application.status = ApplicationStatus.WITHDRAWN;
    await this.applicationRepo.save(application);

    await this.logHistory(
      applicationId,
      oldStatus,
      ApplicationStatus.WITHDRAWN,
      'Ứng viên tự rút đơn',
      userId,
    );

    return { message: 'Đã rút đơn ứng tuyển thành công' };
  }

  private async findCandidateByUserId(userId: number) {
    const candidate = await this.candidateRepo.findOne({
      where: { userId },
    });
    if (!candidate) {
      throw new NotFoundException('Hồ sơ ứng viên không tồn tại');
    }
    return candidate;
  }

  private async logHistory(
    applicationId: number,
    oldStatus: string | null,
    newStatus: string,
    reason: string | null,
    changedById: number | null,
  ) {
    await this.historyRepo.save(
      this.historyRepo.create({
        applicationId,
        oldStatus,
        newStatus,
        reason,
        changedById,
      }),
    );
  }
}
