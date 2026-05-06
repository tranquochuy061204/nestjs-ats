// Core & Config
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';

// Entities
import { AuditLogEntity, AuditLogAction } from './entities/audit-log.entity';

// DTOs
import { AdminAuditLogFilterDto } from './dto/admin-audit-log-filter.dto';
import { buildPaginationMeta } from '../dto/admin-pagination.dto';

export interface CreateAuditLogParams {
  adminId: number;
  action: AuditLogAction;
  resource: string;
  resourceId: string | number;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AdminAuditLogsService {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditLogRepo: Repository<AuditLogEntity>,
  ) {}

  /**
   * Tạo Audit Log. Nếu có truyền EntityManager (trong Transaction), sẽ dùng manager để lưu.
   */
  async log(params: CreateAuditLogParams, manager?: EntityManager) {
    const repo = manager
      ? manager.getRepository(AuditLogEntity)
      : this.auditLogRepo;

    const newLog = repo.create({
      ...params,
      resourceId: String(params.resourceId),
    });

    return repo.save(newLog);
  }

  async getLogs(filter: AdminAuditLogFilterDto) {
    const { page, limit, action, adminId, resource, resourceId } = filter;

    const qb = this.auditLogRepo
      .createQueryBuilder('a')
      .leftJoin('a.admin', 'admin')
      .addSelect(['admin.id', 'admin.email'])
      .orderBy('a.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (action) qb.andWhere('a.action = :action', { action });
    if (adminId) qb.andWhere('a.adminId = :adminId', { adminId });
    if (resource) qb.andWhere('a.resource = :resource', { resource });
    if (resourceId) qb.andWhere('a.resourceId = :resourceId', { resourceId });

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      meta: buildPaginationMeta(total, page, limit),
    };
  }
}
