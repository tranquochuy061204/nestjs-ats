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
  const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

  return {
    data,
    total,
    page,
    lastPage: Math.ceil(total / limit),
  };
}
