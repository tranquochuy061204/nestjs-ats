import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

const AddSkillsSchema = z.object({
  skills: z
    .array(
      z.union([
        z.number().int().positive(),
        z.string().trim().min(1, 'Skill không được để trống').max(50),
      ]),
    )
    .min(1, 'Phải có ít nhất 1 skill')
    .max(20, 'Không được thêm quá 20 skills một lúc'),
});

export class AddSkillsDto extends createZodDto(AddSkillsSchema) {
  @ApiProperty({
    description:
      'Mảng hỗn hợp: số (ID skill đã chọn từ gợi ý) hoặc chuỗi (skill user tự gõ, sẽ được AI format)',
    example: [1, 2, 'Typescrist'],
    type: [Object],
  })
  skills: (number | string)[];
}
