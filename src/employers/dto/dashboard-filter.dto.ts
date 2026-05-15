import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DASHBOARD_CONFIG } from '../../common/constants/dashboard.constant';
import { TimeGranularity, Quarter } from '../../common/enums/time-period.enum';
import {
  DateRange,
  DateRangeBuilder,
} from '../../common/utils/date-range.util';

const DashboardFilterSchema = z
  .object({
    expiringSoonDays: z.coerce
      .number()
      .int()
      .min(DASHBOARD_CONFIG.EXPIRING_SOON_DAYS.MIN)
      .max(DASHBOARD_CONFIG.EXPIRING_SOON_DAYS.MAX)
      .default(DASHBOARD_CONFIG.EXPIRING_SOON_DAYS.DEFAULT),

    // Time filter fields (optional - default to current month)
    year: z.coerce.number().int().min(2020).max(2030).optional(),
    granularity: z.nativeEnum(TimeGranularity).optional(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    month: z.coerce.number().int().min(1).max(12).optional(),
    quarter: z.nativeEnum(Quarter).optional(),
  })
  .refine(
    (data) => {
      const hasFilter =
        data.year ||
        data.granularity ||
        data.date ||
        data.month ||
        data.quarter;
      if (!hasFilter) return true;

      if (!data.year || !data.granularity) return false;

      if (data.granularity === TimeGranularity.DAY && !data.date) return false;
      if (data.granularity === TimeGranularity.MONTH && !data.month)
        return false;
      if (data.granularity === TimeGranularity.QUARTER && !data.quarter)
        return false;
      return true;
    },
    { message: 'Invalid time filter' },
  );

export class DashboardFilterDto extends createZodDto(DashboardFilterSchema) {
  @ApiPropertyOptional({
    description: 'Số ngày tới để xác định job "sắp hết hạn" (1–30, mặc định 7)',
    default: DASHBOARD_CONFIG.EXPIRING_SOON_DAYS.DEFAULT,
    minimum: DASHBOARD_CONFIG.EXPIRING_SOON_DAYS.MIN,
    maximum: DASHBOARD_CONFIG.EXPIRING_SOON_DAYS.MAX,
  })
  expiringSoonDays: number;

  @ApiPropertyOptional({ description: 'Năm (2020-2030)' })
  year?: number;

  @ApiPropertyOptional({ enum: TimeGranularity, description: 'Độ chi tiết' })
  granularity?: TimeGranularity;

  @ApiPropertyOptional({ description: 'Ngày cụ thể (YYYY-MM-DD) cho DAY' })
  date?: string;

  @ApiPropertyOptional({ description: 'Tháng (1-12) cho MONTH' })
  month?: number;

  @ApiPropertyOptional({
    enum: Quarter,
    description: 'Quý (Q1-Q4) cho QUARTER',
  })
  quarter?: Quarter;

  getDateRange(): DateRange | null {
    if (!this.year || !this.granularity) return null;

    return DateRangeBuilder.buildRange(
      this.year,
      this.granularity,
      this.date || this.month || this.quarter,
    );
  }
}
