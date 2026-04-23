import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProjectTable1773970099967 implements MigrationInterface {
  name = 'CreateProjectTable1773970099967';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "project" ("id" SERIAL NOT NULL, "candidate_id" integer NOT NULL, "name" character varying(255) NOT NULL, "start_date" date, "end_date" date, "description" text, CONSTRAINT "PK_4d68b1358bb5b766d3e78f32f57" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "project" ADD CONSTRAINT "FK_28106292f6455e1aa10dc82687c" FOREIGN KEY ("candidate_id") REFERENCES "candidate"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project" DROP CONSTRAINT "FK_28106292f6455e1aa10dc82687c"`,
    );
    await queryRunner.query(`DROP TABLE "project"`);
  }
}
