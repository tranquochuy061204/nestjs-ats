import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DASHBOARD_CONFIG } from '../../common/constants/dashboard.constant';

const DashboardFilterSchema = z.object({
  expiringSoonDays: z.coerce
    .number()
    .int()
    .min(DASHBOARD_CONFIG.EXPIRING_SOON_DAYS.MIN)
    .max(DASHBOARD_CONFIG.EXPIRING_SOON_DAYS.MAX)
    .default(DASHBOARD_CONFIG.EXPIRING_SOON_DAYS.DEFAULT),
});

export class DashboardFilterDto extends createZodDto(DashboardFilterSchema) {
  @ApiPropertyOptional({
    description:
      'Số ngày tới để xác định job "sắp hết hạn" (1–30, mặc định 7)',
    default: DASHBOARD_CONFIG.EXPIRING_SOON_DAYS.DEFAULT,
    minimum: DASHBOARD_CONFIG.EXPIRING_SOON_DAYS.MIN,
    maximum: DASHBOARD_CONFIG.EXPIRING_SOON_DAYS.MAX,
  })
  expiringSoonDays: number;
}
