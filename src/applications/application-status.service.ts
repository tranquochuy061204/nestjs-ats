import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  JobApplicationEntity,
  ApplicationStatus,
} from './entities/job-application.entity';
import { ApplicationStatusHistoryEntity } from './entities/application-status-history.entity';
import { ApplicationNoteEntity } from './entities/application-note.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { ApplicationPipelineFeeService } from './application-pipeline-fee.service';
import { SocketGateway } from '../common/socket/socket.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';
import { EmployerEntity } from '../employers/entities/employer.entity';
import { ForbiddenException } from '@nestjs/common';

@Injectable()
export class ApplicationStatusService {
  private readonly logger = new Logger(ApplicationStatusService.name);

  constructor(
    @InjectRepository(JobApplicationEntity)
    private readonly applicationRepo: Repository<JobApplicationEntity>,
    @InjectRepository(ApplicationStatusHistoryEntity)
    private readonly historyRepo: Repository<ApplicationStatusHistoryEntity>,
    @InjectRepository(EmployerEntity)
    private readonly employerRepo: Repository<EmployerEntity>,
    private readonly dataSource: DataSource,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly pipelineFeeService: ApplicationPipelineFeeService,
    private readonly socketGateway: SocketGateway,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

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

    // ── Pipeline Fee Enforcement ──────────────────────────
    const creditCharged = await this.pipelineFeeService.enforcePipelineFee(
      application.job.companyId,
      oldStatus,
      dto.status,
      applicationId,
      employerUserId,
    );
    // ─────────────────────────────────────────────────────

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
          creditCharged,
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
        const appUrl = this.configService.get<string>('FRONTEND_URL');
        if (!appUrl) {
          this.logger.warn('FRONTEND_URL is not configured');
        }
        const finalAppUrl = appUrl || 'http://localhost:5173';
        const actionUrl = `${finalAppUrl}/candidate/applications/${applicationId}`;

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
