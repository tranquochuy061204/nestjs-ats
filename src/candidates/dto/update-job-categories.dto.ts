import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

const UpdateJobCategoriesSchema = z.object({
  categoryIds: z
    .array(z.number().int().positive())
    .min(1, 'Phải chọn ít nhất 1 ngành nghề')
    .max(10, 'Không được chọn quá 10 ngành nghề'),
});

export class UpdateJobCategoriesDto extends createZodDto(
  UpdateJobCategoriesSchema,
) {
  @ApiProperty({
    description: 'Danh sách ID của các ngành nghề',
    example: [1, 2, 3],
  })
  categoryIds: number[];
}
