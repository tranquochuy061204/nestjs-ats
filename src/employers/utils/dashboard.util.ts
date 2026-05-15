import dayjs from 'dayjs';
import { RawTrendRow } from '../interfaces/employer-dashboard.interface';
import { DateRange } from '../../common/utils/date-range.util';

/** Tính tỉ lệ chuyển đổi, trả về null nếu mẫu số = 0 */
export function conversionRate(
  numerator: number,
  denominator: number,
): number | null {
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10; // 1 decimal
}

export function fillTrendDays(
  rawRows: RawTrendRow[],
  daysOrRange: number | DateRange,
  granularity: 'day' | 'month' | 'quarter' = 'day',
): { date: string; count: number }[] {
  let startDate: Date;
  let endDate: Date;

  if (typeof daysOrRange === 'number') {
    // Backward compatibility: số ngày từ hiện tại
    const days = daysOrRange;
    endDate = new Date();
    startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  } else {
    // New: use DateRange
    startDate = daysOrRange.startDate;
    endDate = daysOrRange.endDate;
  }

  const isMonthly = granularity === 'quarter';
  const formatStr = isMonthly ? 'YYYY-MM' : 'YYYY-MM-DD';

  const map = new Map(
    rawRows.map((r) => [
      String(r.date).slice(0, isMonthly ? 7 : 10),
      parseInt(r.count, 10),
    ]),
  );

  const result: { date: string; count: number }[] = [];
  let current = dayjs(startDate);
  const end = dayjs(endDate);

  if (isMonthly) {
    current = current.startOf('month');
    while (current.isBefore(end, 'month') || current.isSame(end, 'month')) {
      const dateStr = current.format(formatStr);
      result.push({ date: dateStr, count: map.get(dateStr) ?? 0 });
      current = current.add(1, 'month');
    }
  } else {
    while (current.isBefore(end, 'day') || current.isSame(end, 'day')) {
      const dateStr = current.format(formatStr);
      result.push({ date: dateStr, count: map.get(dateStr) ?? 0 });
      current = current.add(1, 'day');
    }
  }

  return result;
}
