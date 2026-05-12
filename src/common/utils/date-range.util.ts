import { TimeGranularity, Quarter } from '../enums/time-period.enum';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export class DateRangeBuilder {
  static buildRange(
    year: number,
    granularity: TimeGranularity,
    value?: string | number,
  ): DateRange {
    switch (granularity) {
      case TimeGranularity.DAY:
        return this.getDayRange(value as string);
      case TimeGranularity.MONTH:
        return this.getMonthRange(year, value as number);
      case TimeGranularity.QUARTER:
        return this.getQuarterRange(year, value as Quarter);
      default:
        throw new Error(`Unsupported granularity: ${granularity}`);
    }
  }

  static getDayRange(dateStr: string): DateRange {
    const [year, month, day] = dateStr.split('-').map(Number);
    const startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
    const endDate = new Date(year, month - 1, day, 23, 59, 59, 999);

    return { startDate, endDate };
  }

  static getMonthRange(year: number, month: number): DateRange {
    const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    return { startDate, endDate };
  }

  static getQuarterRange(year: number, quarter: Quarter): DateRange {
    const quarterMonths = {
      [Quarter.Q1]: { start: 0, end: 2 },
      [Quarter.Q2]: { start: 3, end: 5 },
      [Quarter.Q3]: { start: 6, end: 8 },
      [Quarter.Q4]: { start: 9, end: 11 },
    };

    const { start, end } = quarterMonths[quarter];
    const startDate = new Date(year, start, 1, 0, 0, 0, 0);
    const endDate = new Date(year, end + 1, 0, 23, 59, 59, 999);

    return { startDate, endDate };
  }

  static getCurrentMonthRange(): DateRange {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    return this.getMonthRange(year, month);
  }
}
