import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  JobApplicationEntity,
  ApplicationStatus,
} from './entities/job-application.entity';
import { ApplicationStatusHistoryEntity } from './entities/application-status-history.entity';
import { JobEntity } from '../jobs/entities/job.entity';
import { EmployerEntity } from '../employers/entities/employer.entity';
import { ApplicationFilterDto } from './dto/application-filter.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';
import { ApplicationNoteEntity } from './entities/application-note.entity';
import { CreateApplicationNoteDto } from './dto/create-application-note.dto';
import { UpdateApplicationNoteDto } from './dto/update-application-note.dto';
import { SocketGateway } from '../common/socket/socket.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { UserEntity } from '../users/entities/user.entity';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';

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
    @InjectRepository(ApplicationNoteEntity)
    private readonly noteRepo: Repository<ApplicationNoteEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly dataSource: DataSource,
    private readonly socketGateway: SocketGateway,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
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
      .leftJoinAndSelect('candidate.skills', 'skills')
      .leftJoinAndSelect('skills.skillMetadata', 'skillMetadata')
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

    // 1. Tính tổng số lượng ở mỗi cột
    const counts = await this.applicationRepo
      .createQueryBuilder('app')
      .select('app.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .where('app.jobId = :jobId', { jobId })
      .groupBy('app.status')
      .getRawMany<{ status: string; count: number }>();

    const countMap = new Map<string, number>();
    for (const row of counts) {
      countMap.set(row.status, row.count);
    }

    // 2. Chạy 8 query song song để lấy 10 item mới nhất cho mỗi cột (tránh N+1 và load vào RAM)
    const columnPromises = columns.map(async (col) => {
      const items = await this.applicationRepo.find({
        where: { jobId, status: col.id },
        relations: [
          'candidate',
          'candidate.skills',
          'candidate.skills.skillMetadata',
        ],
        order: { appliedAt: 'DESC' },
        take: 10,
      });

      return {
        id: col.id,
        title: col.title,
        count: countMap.get(col.id) || 0,
        items,
      };
    });

    return Promise.all(columnPromises);
  }

  async getApplicationDetail(employerUserId: number, applicationId: number) {
    const employer = await this.findEmployerByUserId(employerUserId);

    const application = await this.applicationRepo.findOne({
      where: {
        id: applicationId,
        job: { companyId: employer.companyId }, // Early Check Authorization
      },
      relations: [
        'job',
        'candidate',
        'candidate.skills',
        'candidate.skills.skillMetadata',
        'candidate.workExperiences',
        'candidate.projects',
        'candidate.certificates',
        'statusHistory',
        'notes',
        'notes.author',
        'notes.author.employer',
      ],
      order: {
        notes: { createdAt: 'DESC' },
      },
    });

    if (!application) {
      throw new NotFoundException(
        'Đơn ứng tuyển không tồn tại hoặc bạn không có quyền truy cập',
      );
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
      where: {
        id: applicationId,
        job: { companyId: employer.companyId },
      },
      relations: ['job', 'job.company', 'candidate', 'candidate.user'],
    });

    if (!application) {
      throw new NotFoundException(
        'Đơn ứng tuyển không tồn tại hoặc bạn không có quyền truy cập',
      );
    }

    const finalStatuses: string[] = [
      ApplicationStatus.HIRED,
      ApplicationStatus.REJECTED,
      ApplicationStatus.WITHDRAWN,
    ];

    const finalStatusMessages: Record<string, string> = {
      [ApplicationStatus.HIRED]:
        'Không thể thay đổi trạng thái đơn đã được tuyển dụng',
      [ApplicationStatus.REJECTED]:
        'Không thể thay đổi trạng thái đơn đã bị từ chối. Hãy tạo đơn mới nếu cần.',
      [ApplicationStatus.WITHDRAWN]:
        'Không thể thay đổi trạng thái đơn đã được ứng viên rút',
    };

    if (finalStatuses.includes(application.status)) {
      throw new BadRequestException(
        finalStatusMessages[application.status] ??
          'Đơn ứng tuyển đã ở trạng thái cuối, không thể thay đổi',
      );
    }

    const employerForbiddenStatuses: string[] = [
      ApplicationStatus.APPLIED,
      ApplicationStatus.WITHDRAWN,
    ];
    if (employerForbiddenStatuses.includes(dto.status)) {
      throw new BadRequestException(
        `Nhà tuyển dụng không được phép chuyển sang trạng thái "${dto.status}"`,
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

    await this.dataSource.transaction(async (manager) => {
      await manager.save(JobApplicationEntity, application);
      await manager.save(
        ApplicationStatusHistoryEntity,
        manager.create(ApplicationStatusHistoryEntity, {
          applicationId,
          oldStatus,
          newStatus: dto.status,
          reason: dto.reason ?? null,
          changedById: employerUserId,
        }),
      );
      if (dto.note) {
        await manager.save(
          ApplicationNoteEntity,
          manager.create(ApplicationNoteEntity, {
            applicationId,
            authorId: employerUserId,
            content: dto.note,
          }),
        );
      }
    });

    // --- REAL-TIME INTEGRATION ---
    try {
      // 1. Cập nhật Bảng Kanban (Real-time cho các Recruiter khác)
      this.socketGateway.sendToJobBoard(application.jobId, 'kanban_update', {
        applicationId,
        oldStatus,
        newStatus: dto.status,
        actor: employer.fullName || 'Nhà tuyển dụng',
      });

      // 2. Thông báo cho Ứng viên (DB Persistence + Real-time)
      if (application.candidate?.userId) {
        await this.notificationsService.createNotification({
          userId: application.candidate.userId,
          type: NotificationType.APPLICATION_STATUS,
          title: 'Cập nhật trạng thái ứng tuyển',
          content: `Hồ sơ của bạn cho vị trí "${application.job.title}" đã được chuyển sang trạng thái: ${dto.status}`,
          metadata: {
            jobId: application.jobId,
            applicationId,
            status: dto.status,
          },
        });
      }
      // 3. Gửi Email thông báo (Chỉ các trạng thái quan trọng)
      const importantStatuses = [
        ApplicationStatus.INTERVIEW,
        ApplicationStatus.OFFER,
        ApplicationStatus.HIRED,
        ApplicationStatus.REJECTED,
      ];

      if (
        importantStatuses.includes(dto.status) &&
        application.candidate?.user?.email
      ) {
        const appUrl =
          this.configService.get<string>('APP_URL') || 'http://localhost:3000';
        const actionUrl = `${appUrl}/candidate/applications/${applicationId}`;

        void this.mailService.sendApplicationStatusEmail(
          application.candidate.user.email,
          application.candidate.fullName || 'Ứng viên',
          application.job.title,
          dto.status,
          application.job.company?.name || 'Công ty',
          actionUrl,
          dto.reason || undefined,
        );
      }
    } catch (error) {
      this.logger.error(
        'External notification integration failed in update status',
        error instanceof Error ? error.stack : String(error),
      );
    }

    return {
      message: `Đã cập nhật trạng thái thành "${dto.status}"`,
    };
  }

  async getApplicationHistory(employerUserId: number, applicationId: number) {
    const employer = await this.findEmployerByUserId(employerUserId);

    const application = await this.applicationRepo.findOne({
      where: {
        id: applicationId,
        job: { companyId: employer.companyId },
      },
      relations: ['job'],
    });

    if (!application) {
      throw new NotFoundException(
        'Đơn ứng tuyển không tồn tại hoặc bạn không có quyền truy cập',
      );
    }

    return this.historyRepo.find({
      where: { applicationId },
      order: { createdAt: 'DESC' },
    });
  }

  async addNote(
    employerUserId: number,
    applicationId: number,
    dto: CreateApplicationNoteDto,
  ) {
    const employer = await this.findEmployerByUserId(employerUserId);

    const application = await this.applicationRepo.findOne({
      where: {
        id: applicationId,
        job: { companyId: employer.companyId },
      },
      relations: ['job'],
    });

    if (!application) {
      throw new NotFoundException(
        'Đơn ứng tuyển không tồn tại hoặc bạn không có quyền truy cập',
      );
    }

    const note = this.noteRepo.create({
      applicationId,
      authorId: employerUserId,
      content: dto.content,
    });

    const savedNote = await this.noteRepo.save(note);

    // --- REAL-TIME INTEGRATION ---
    try {
      // Fetch full note with author info for detailed timeline update
      const fullNote = await this.noteRepo.findOne({
        where: { id: savedNote.id },
        relations: ['author', 'author.employer'],
      });

      // 1. Emit tới phòng chi tiết hồ sơ (Real-time Timeline)
      this.socketGateway.sendToApplicationDetail(
        applicationId,
        'new_note',
        fullNote,
      );

      // 2. Emit tới bảng Kanban (Để cập nhật badge hoặc preview)
      const noteCount = await this.noteRepo.count({ where: { applicationId } });
      this.socketGateway.sendToJobBoard(application.jobId, 'kanban_note', {
        applicationId,
        noteCount,
      });
    } catch (error) {
      this.logger.error(
        'Real-time emit failed for add note',
        error instanceof Error ? error.stack : String(error),
      );
    }

    return savedNote;
  }

  async updateNote(
    employerUserId: number,
    noteId: number,
    dto: UpdateApplicationNoteDto,
  ) {
    const employer = await this.findEmployerByUserId(employerUserId);

    const note = await this.noteRepo.findOne({
      where: { id: noteId },
      relations: ['application', 'application.job'],
    });

    if (!note) {
      throw new NotFoundException('Không tìm thấy ghi chú');
    }

    // Kiểm tra quyền: Chỉ người tạo và thuộc cùng công ty mới được sửa
    if (note.authorId !== employerUserId) {
      throw new ForbiddenException(
        'Bạn không có quyền sửa ghi chú của người khác',
      );
    }

    if (note.application.job.companyId !== employer.companyId) {
      throw new ForbiddenException('Ghi chú không thuộc công ty của bạn');
    }

    note.content = dto.content;
    return this.noteRepo.save(note);
  }

  private async findEmployerByUserId(userId: number) {
    const employer = await this.employerRepo.findOne({
      where: { userId },
    });
    if (!employer) {
      throw new ForbiddenException('Tài khoản không phải nhà tuyển dụng');
    }
    if (employer.companyId === null || employer.companyId === undefined) {
      throw new ForbiddenException(
        'Bạn phải tham gia vào một công ty trước khi quản lý ứng tuyển',
      );
    }
    return employer as EmployerEntity & { companyId: number };
  }
}
