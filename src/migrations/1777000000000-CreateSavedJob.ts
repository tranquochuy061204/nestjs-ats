import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSavedJob1777000000000 implements MigrationInterface {
  name = 'CreateSavedJob1777000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "saved_job" (
        "id" SERIAL NOT NULL,
        "candidate_id" integer NOT NULL,
        "job_id" integer NOT NULL,
        "saved_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_saved_job_candidate_job" UNIQUE ("candidate_id", "job_id"),
        CONSTRAINT "PK_saved_job" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_saved_job_candidate_id" ON "saved_job" ("candidate_id")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_saved_job_job_id" ON "saved_job" ("job_id")`,
    );

    await queryRunner.query(`
      ALTER TABLE "saved_job"
        ADD CONSTRAINT "FK_saved_job_candidate"
        FOREIGN KEY ("candidate_id") REFERENCES "candidate"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "saved_job"
        ADD CONSTRAINT "FK_saved_job_job"
        FOREIGN KEY ("job_id") REFERENCES "job"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "saved_job" DROP CONSTRAINT "FK_saved_job_job"`,
    );
    await queryRunner.query(
      `ALTER TABLE "saved_job" DROP CONSTRAINT "FK_saved_job_candidate"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_saved_job_job_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_saved_job_candidate_id"`,
    );
    await queryRunner.query(`DROP TABLE "saved_job"`);
  }
}
