import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Chuẩn hóa toàn bộ response thành:
 *   { data, pagination?, summary?, message? }
 *
 * Nếu service đã trả về object có key `data` (đã là đúng format),
 * interceptor sẽ giữ nguyên và không bọc thêm lần nữa.
 */
export interface Response<T> {
  data: T;
}

@Injectable()
export class TransformInterceptor<T>
  implements
    NestInterceptor<
      T,
      Response<T>
    >
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    return next.handle().pipe(
      map((value: unknown) => {
        // Nếu response đã là null/undefined
        if (value == null) return { data: null as unknown as T };

        // Nếu đã là dạng chuẩn { data, ... } — không bọc thêm
        if (
          typeof value === 'object' &&
          !Array.isArray(value) &&
          value !== null &&
          'data' in (value as Record<string, unknown>)
        ) {
          return value as unknown as Response<T>;
        }

        // Bọc array hoặc object thuần thành { data }
        return { data: value as T };
      }),
    );
  }
}
