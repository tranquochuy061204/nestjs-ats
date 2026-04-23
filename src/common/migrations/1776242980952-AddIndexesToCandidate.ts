import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIndexesToCandidate1776242980952 implements MigrationInterface {
  name = 'AddIndexesToCandidate1776242980952';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_15f686594fadaa8343c1328ac1" ON "candidate_job_category" ("job_category_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_236ccc3920c30ec48fbefc4e00" ON "candidate_skill_tag" ("skill_metadata_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9def570f069ad76899311f4f94" ON "candidate" ("province_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d2d3bed68e22a32d7dabfa940f" ON "candidate" ("job_type_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_baa13332c0d62062e33d352ee1" ON "candidate" ("year_working_experience") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_460bb61f6525b4c3c109293e26" ON "candidate" ("is_public") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_460bb61f6525b4c3c109293e26"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_baa13332c0d62062e33d352ee1"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d2d3bed68e22a32d7dabfa940f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9def570f069ad76899311f4f94"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_236ccc3920c30ec48fbefc4e00"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_15f686594fadaa8343c1328ac1"`,
    );
  }
}
