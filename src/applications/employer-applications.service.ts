import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  JobApplicationEntity,
  ApplicationStatus,
} from './entities/job-application.entity';
import { ApplicationStatusHistoryEntity } from './entities/application-status-history.entity';
import { JobEntity } from '../jobs/entities/job.entity';
import { EmployerEntity } from '../employers/entities/employer.entity';
import { ApplicationFilterDto } from './dto/application-filter.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';

@Injectable()
export class EmployerApplicationsService {
  private readonly logger = new Logger(EmployerApplicationsService.name);

  constructor(
    @InjectRepository(JobApplicationEntity)
    private readonly applicationRepo: Repository<JobApplicationEntity>,
    @InjectRepository(ApplicationStatusHistoryEntity)
    private readonly historyRepo: Repository<ApplicationStatusHistoryEntity>,
    @InjectRepository(JobEntity)
    private readonly jobRepo: Repository<JobEntity>,
    @InjectRepository(EmployerEntity)
    private readonly employerRepo: Repository<EmployerEntity>,
  ) {}

  async getJobApplications(
    employerUserId: number,
    jobId: number,
    filterDto: ApplicationFilterDto,
  ) {
    const employer = await this.findEmployerByUserId(employerUserId);

    const job = await this.jobRepo.findOne({
      where: { id: jobId, companyId: employer.companyId },
    });
    if (!job) {
      throw new NotFoundException(
        'Tin tuyển dụng không tồn tại hoặc không thuộc công ty của bạn',
      );
    }

    const { page = 1, limit = 10, status } = filterDto;

    const qb = this.applicationRepo
      .createQueryBuilder('app')
      .leftJoinAndSelect('app.candidate', 'candidate')
      .where('app.jobId = :jobId', { jobId });

    if (status) {
      qb.andWhere('app.status = :status', { status });
    }

    qb.orderBy('app.appliedAt', 'DESC');

    const skip = (page - 1) * limit;
    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return { data, total, page, lastPage: Math.ceil(total / limit) };
  }

  async getKanbanBoard(employerUserId: number, jobId: number) {
    const employer = await this.findEmployerByUserId(employerUserId);

    const job = await this.jobRepo.findOne({
      where: { id: jobId, companyId: employer.companyId },
    });
    if (!job) {
      throw new NotFoundException(
        'Tin tuyển dụng không tồn tại hoặc không thuộc công ty của bạn',
      );
    }

    const columns = [
      { id: ApplicationStatus.APPLIED, title: 'Mới ứng tuyển' },
      { id: ApplicationStatus.SHORTLISTED, title: 'Tiềm năng' },
      { id: ApplicationStatus.SKILL_TEST, title: 'Skill Test' },
      { id: ApplicationStatus.INTERVIEW, title: 'Phỏng vấn' },
      { id: ApplicationStatus.OFFER, title: 'Gửi đề nghị' },
      { id: ApplicationStatus.HIRED, title: 'Đã tuyển' },
      { id: ApplicationStatus.REJECTED, title: 'Đã từ chối' },
      { id: ApplicationStatus.WITHDRAWN, title: 'Đã rút đơn' },
    ];

    const result = [];

    for (const column of columns) {
      const qb = this.applicationRepo
        .createQueryBuilder('app')
        .leftJoinAndSelect('app.candidate', 'candidate')
        .where('app.jobId = :jobId', { jobId })
        .andWhere('app.status = :status', { status: column.id })
        .orderBy('app.appliedAt', 'DESC');

      const count = await qb.getCount();
      const items = await qb.take(10).getMany();

      result.push({
        id: column.id,
        title: column.title,
        count,
        items,
      });
    }

    return result;
  }

  async getApplicationDetail(employerUserId: number, applicationId: number) {
    const employer = await this.findEmployerByUserId(employerUserId);

    const application = await this.applicationRepo.findOne({
      where: { id: applicationId },
      relations: [
        'job',
        'candidate',
        'candidate.skills',
        'candidate.skills.skillMetadata',
        'candidate.workExperiences',
        'candidate.educations',
        'candidate.certificates',
        'statusHistory',
      ],
    });

    if (!application) {
      throw new NotFoundException('Đơn ứng tuyển không tồn tại');
    }

    if (application.job.companyId !== employer.companyId) {
      throw new ForbiddenException('Bạn không có quyền xem đơn ứng tuyển này');
    }

    return application;
  }

  async updateApplicationStatus(
    employerUserId: number,
    applicationId: number,
    dto: UpdateApplicationStatusDto,
  ) {
    const employer = await this.findEmployerByUserId(employerUserId);

    const application = await this.applicationRepo.findOne({
      where: { id: applicationId },
      relations: ['job'],
    });

    if (!application) {
      throw new NotFoundException('Đơn ứng tuyển không tồn tại');
    }

    if (application.job.companyId !== employer.companyId) {
      throw new ForbiddenException(
        'Bạn không có quyền thay đổi đơn ứng tuyển này',
      );
    }

    if (application.status === (ApplicationStatus.WITHDRAWN as string)) {
      throw new BadRequestException(
        'Không thể thay đổi trạng thái đơn đã được ứng viên rút',
      );
    }

    if (dto.status === ApplicationStatus.REJECTED && !dto.reason) {
      throw new BadRequestException(
        'Vui lòng cung cấp lý do khi từ chối ứng viên',
      );
    }

    const oldStatus = application.status;
    application.status = dto.status;

    if (dto.status === ApplicationStatus.REJECTED) {
      application.rejectionReason = dto.reason ?? null;
    }

    if (dto.note !== undefined) {
      application.employerNote = dto.note ?? null;
    }

    await this.applicationRepo.save(application);

    await this.logHistory(
      applicationId,
      oldStatus,
      dto.status,
      dto.reason ?? null,
      employerUserId,
    );

    return {
      message: `Đã cập nhật trạng thái thành "${dto.status}"`,
    };
  }

  async getApplicationHistory(employerUserId: number, applicationId: number) {
    const employer = await this.findEmployerByUserId(employerUserId);

    const application = await this.applicationRepo.findOne({
      where: { id: applicationId },
      relations: ['job'],
    });

    if (!application) {
      throw new NotFoundException('Đơn ứng tuyển không tồn tại');
    }

    if (application.job.companyId !== employer.companyId) {
      throw new ForbiddenException(
        'Bạn không có quyền xem lịch sử đơn ứng tuyển này',
      );
    }

    return this.historyRepo.find({
      where: { applicationId },
      order: { createdAt: 'DESC' },
    });
  }

  private async findEmployerByUserId(userId: number) {
    const employer = await this.employerRepo.findOne({
      where: { userId },
    });
    if (!employer) {
      throw new ForbiddenException('Tài khoản không phải nhà tuyển dụng');
    }
    if (!employer.companyId) {
      throw new ForbiddenException(
        'Bạn phải tham gia vào một công ty trước khi quản lý ứng tuyển',
      );
    }
    return employer;
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
