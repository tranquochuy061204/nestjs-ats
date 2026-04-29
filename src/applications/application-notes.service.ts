import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobApplicationEntity } from './entities/job-application.entity';
import { ApplicationNoteEntity } from './entities/application-note.entity';
import { CreateApplicationNoteDto } from './dto/create-application-note.dto';
import { UpdateApplicationNoteDto } from './dto/update-application-note.dto';
import { SocketGateway } from '../common/socket/socket.gateway';
import { EmployerEntity } from '../employers/entities/employer.entity';

@Injectable()
export class ApplicationNotesService {
  private readonly logger = new Logger(ApplicationNotesService.name);

  constructor(
    @InjectRepository(JobApplicationEntity)
    private readonly applicationRepo: Repository<JobApplicationEntity>,
    @InjectRepository(ApplicationNoteEntity)
    private readonly noteRepo: Repository<ApplicationNoteEntity>,
    @InjectRepository(EmployerEntity)
    private readonly employerRepo: Repository<EmployerEntity>,
    private readonly socketGateway: SocketGateway,
  ) {}

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

    const fullNote = await this.noteRepo.findOne({
      where: { id: savedNote.id },
      relations: ['author', 'author.employer'],
    });

    try {
      this.socketGateway.sendToApplicationDetail(
        applicationId,
        'new_note',
        fullNote,
      );

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

    return fullNote ?? savedNote;
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
