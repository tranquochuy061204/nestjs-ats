import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

const UpdateJobCategoriesSchema = z.object({
  categoryIds: z.array(z.number().int().positive()).min(1),
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
