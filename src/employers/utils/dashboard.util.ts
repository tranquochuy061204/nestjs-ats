import { RawTrendRow } from '../interfaces/employer-dashboard.interface';

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
  days: number,
): { date: string; count: number }[] {
  // Postgres TO_CHAR đảm bảo r.date luôn là string 'YYYY-MM-DD'
  const map = new Map(
    rawRows.map((r) => [String(r.date).slice(0, 10), parseInt(r.count, 10)]),
  );

  const result: { date: string; count: number }[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const dateStr = d.toISOString().slice(0, 10); // YYYY-MM-DD
    result.push({ date: dateStr, count: map.get(dateStr) ?? 0 });
  }

  return result;
}
