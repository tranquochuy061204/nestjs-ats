import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';

const UpdateCreditPackageSchema = z.object({
  displayName: z.string().optional(),
  creditBase: z.coerce.number().int().min(1).optional(),
  bonus: z.coerce.number().int().min(0).optional(),
  priceVnd: z.coerce.number().min(0).optional(),
  isActive: z.coerce.boolean().optional(),
});

export class UpdateCreditPackageDto extends createZodDto(UpdateCreditPackageSchema) {
  @ApiPropertyOptional({ description: 'Tên hiển thị gói nạp' })
  displayName?: string;

  @ApiPropertyOptional({ description: 'Số credit cơ bản (ví dụ: 500)' })
  creditBase?: number;

  @ApiPropertyOptional({ description: 'Credit bonus thêm khi mua gói này' })
  bonus?: number;

  @ApiPropertyOptional({ description: 'Giá VNĐ' })
  priceVnd?: number;

  @ApiPropertyOptional({ description: 'false = ẩn khỏi trang mua của nhà tuyển dụng' })
  isActive?: boolean;
}

const CreateCreditPackageSchema = UpdateCreditPackageSchema.extend({
  slug: z.string().min(1),
});

export class CreateCreditPackageDto extends createZodDto(CreateCreditPackageSchema) {
  @ApiPropertyOptional({ description: 'Slug định danh duy nhất (ví dụ: pack_500)' })
  slug: string;

  @ApiPropertyOptional({ description: 'Tên hiển thị gói nạp' })
  displayName?: string;

  @ApiPropertyOptional({ description: 'Số credit cơ bản (ví dụ: 500)' })
  creditBase?: number;

  @ApiPropertyOptional({ description: 'Credit bonus thêm khi mua gói này' })
  bonus?: number;

  @ApiPropertyOptional({ description: 'Giá VNĐ' })
  priceVnd?: number;

  @ApiPropertyOptional({ description: 'false = ẩn khỏi trang mua của nhà tuyển dụng' })
  isActive?: boolean;
}
