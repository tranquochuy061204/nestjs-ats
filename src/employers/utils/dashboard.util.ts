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

/** Fill các ngày thiếu trong khoảng trend với count = 0 */
export function fillTrendDays(
  rawRows: RawTrendRow[],
  daysOrRange: number | DateRange,
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

  const map = new Map(
    rawRows.map((r) => [String(r.date).slice(0, 10), parseInt(r.count, 10)]),
  );

  const result: { date: string; count: number }[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const dateStr = current.toISOString().slice(0, 10);
    result.push({ date: dateStr, count: map.get(dateStr) ?? 0 });
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return result;
}
