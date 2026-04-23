import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationStatus } from '../entities/job-application.entity';
import { PAGINATION_DEFAULTS } from '../../common/constants/headhunting.constant';

const ApplicationFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(PAGINATION_DEFAULTS.PAGE),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION_DEFAULTS.MAX_LIMIT)
    .default(PAGINATION_DEFAULTS.LIMIT),
  status: z.enum(ApplicationStatus).optional(),
});

export class ApplicationFilterDto extends createZodDto(
  ApplicationFilterSchema,
) {
  @ApiPropertyOptional({ description: 'Trang hiện tại', default: 1 })
  page: number;

  @ApiPropertyOptional({ description: 'Số bản ghi trên trang', default: 10 })
  limit: number;

  @ApiPropertyOptional({
    description:
      'Lọc theo trạng thái (applied, shortlisted, skill_test, interview, offer, hired, rejected, withdrawn)',
    enum: ApplicationStatus,
  })
  status?: ApplicationStatus;
}
