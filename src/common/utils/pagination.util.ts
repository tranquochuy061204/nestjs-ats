import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  lastPage: number;
}

export async function getPaginatedResult<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  page: number,
  limit: number,
): Promise<PaginatedResult<T>> {
  const skip = (page - 1) * limit;

  // NOTE: Dùng getCount() + getMany() riêng thay vì getManyAndCount() để tránh
  // lỗi TypeORM khi ORDER BY dùng raw expression hoặc alias trong COUNT subquery.
  const total = await qb.getCount();
  const data = await qb.skip(skip).take(limit).getMany();

  return {
    data,
    total,
    page,
    lastPage: Math.ceil(total / limit),
  };
}
