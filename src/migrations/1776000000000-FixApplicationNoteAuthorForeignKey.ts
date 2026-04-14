import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixApplicationNoteAuthorForeignKey1776000000000
  implements MigrationInterface
{
  name = 'FixApplicationNoteAuthorForeignKey1776000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Xóa khóa ngoại cũ đang trỏ sang bảng employer
    await queryRunner.query(
      `ALTER TABLE "application_note" DROP CONSTRAINT "FK_9fd116a1c093195a7049de0000d"`,
    );

    // 2. Tạo khóa ngoại mới trỏ sang bảng user
    await queryRunner.query(
      `ALTER TABLE "application_note" ADD CONSTRAINT "FK_application_note_author_user" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Hoàn tác: Xóa khóa ngoại trỏ sang user
    await queryRunner.query(
      `ALTER TABLE "application_note" DROP CONSTRAINT "FK_application_note_author_user"`,
    );

    // Hoàn tác: Tạo lại khóa ngoại trỏ sang employer
    await queryRunner.query(
      `ALTER TABLE "application_note" ADD CONSTRAINT "FK_9fd116a1c093195a7049de0000d" FOREIGN KEY ("author_id") REFERENCES "employer"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
