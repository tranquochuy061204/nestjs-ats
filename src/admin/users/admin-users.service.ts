// Core & Config
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// Entities
import {
  UserEntity,
  UserRole,
  UserStatus,
} from '../../users/entities/user.entity';

// DTOs
import { AdminUserFilterDto } from './dto/admin-user-filter.dto';
import { buildPaginationMeta } from '../dto/admin-pagination.dto';

// Services
import { AdminAuditLogsService } from '../audit-logs/admin-audit-logs.service';
import { AuditLogAction } from '../audit-logs/enums/audit-log-action.enum';

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly auditLogsService: AdminAuditLogsService,
  ) {}

  async getUsers(filter: AdminUserFilterDto) {
    const {
      role,
      status,
      search,
      sortBy = 'created_at',
      order = 'DESC',
    } = filter;
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;

    const qb = this.userRepo
      .createQueryBuilder('u')
      .select([
        'u.id',
        'u.email',
        'u.role',
        'u.status',
        'u.isEmailVerified',
        'u.created_at',
      ])
      .leftJoin('u.employer', 'emp')
      .addSelect(['emp.id', 'emp.fullName'])
      .leftJoin('emp.company', 'company')
      .addSelect(['company.id', 'company.name', 'company.status'])
      .leftJoin('u.candidate', 'cand')
      .addSelect(['cand.id', 'cand.fullName'])
      .orderBy(`u.${sortBy}`, order);

    if (role) {
      qb.andWhere('u.role = :role', { role });
    }
    if (status) {
      qb.andWhere('u.status = :status', { status });
    }
    if (filter.isEmailVerified !== undefined) {
      qb.andWhere('u.isEmailVerified = :verified', {
        verified: filter.isEmailVerified,
      });
    }
    if (search) {
      qb.andWhere('u.email ILIKE :search', { search: `%${search}%` });
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: data.map((u) => this.mapUserResponse(u)),
      pagination: buildPaginationMeta(total, page, limit),
    };
  }

  async getUserById(id: number) {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['employer', 'employer.company', 'candidate'],
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        isEmailVerified: true,
        created_at: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.mapUserResponse(user);
  }

  async lockUser(id: number, adminId: number) {
    const user = await this.findUserOrFail(id);
    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException('Không thể khóa tài khoản Admin');
    }
    await this.userRepo.update(id, { status: UserStatus.LOCKED });

    await this.auditLogsService.log({
      adminId,
      action: AuditLogAction.LOCK_USER,
      resource: 'user',
      resourceId: id,
      oldValues: { status: user.status },
      newValues: { status: UserStatus.LOCKED },
    });

    return { message: `Tài khoản #${id} đã bị khóa` };
  }

  async unlockUser(id: number, adminId: number) {
    const user = await this.findUserOrFail(id);
    await this.userRepo.update(id, { status: UserStatus.ACTIVE });

    await this.auditLogsService.log({
      adminId,
      action: AuditLogAction.UNLOCK_USER,
      resource: 'user',
      resourceId: id,
      oldValues: { status: user.status },
      newValues: { status: UserStatus.ACTIVE },
    });

    return { message: `Tài khoản #${id} đã được mở khóa` };
  }

  async verifyEmail(id: number, adminId: number) {
    const user = await this.findUserOrFail(id);
    await this.userRepo.update(id, {
      isEmailVerified: true,
      emailVerificationToken: null,
    });

    await this.auditLogsService.log({
      adminId,
      action: AuditLogAction.VERIFY_EMAIL,
      resource: 'user',
      resourceId: id,
      oldValues: { isEmailVerified: user.isEmailVerified },
      newValues: { isEmailVerified: true },
    });

    return { message: `Email của user #${id} đã được xác thực thủ công` };
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async findUserOrFail(id: number) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private mapUserResponse(user: UserEntity) {
    const profile: Record<string, unknown> = {};

    if (user.employer) {
      profile.type = 'employer';
      profile.fullName = user.employer.fullName;
      if (user.employer.company) {
        profile.companyId = user.employer.company.id;
        profile.companyName = user.employer.company.name;
        profile.companyStatus = user.employer.company.status;
      }
    } else if (user.candidate) {
      profile.type = 'candidate';
      profile.fullName = user.candidate.fullName;
    } else {
      profile.type = user.role; // admin
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.created_at,
      profile,
    };
  }
}
