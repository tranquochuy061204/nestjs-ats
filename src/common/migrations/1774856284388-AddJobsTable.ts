import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddJobsTable1774856284388 implements MigrationInterface {
  name = 'AddJobsTable1774856284388';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "job_skill_tag" ("id" SERIAL NOT NULL, "job_id" integer NOT NULL, "skill_id" integer, "tagText" character varying(100), CONSTRAINT "PK_44f76f6ef5129867fb18f730b1d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "job" ("id" SERIAL NOT NULL, "company_id" integer NOT NULL, "employer_id" integer NOT NULL, "title" character varying(255) NOT NULL, "description" text NOT NULL, "requirements" text, "benefits" text, "salary_min" integer, "salary_max" integer, "currency" character varying(10) NOT NULL DEFAULT 'VND', "years_of_experience" integer, "province_id" character varying, "category_id" integer, "job_type_id" integer, "status" character varying(20) NOT NULL DEFAULT 'draft', "slots" integer, "deadline" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_98ab1c14ff8d1cf80d18703b92f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "job_skill_tag" ADD CONSTRAINT "FK_22fd397967d8cf550882d819185" FOREIGN KEY ("job_id") REFERENCES "job"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "job_skill_tag" ADD CONSTRAINT "FK_ada5b78243b2bf23ff7e175a905" FOREIGN KEY ("skill_id") REFERENCES "skill_metadata"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "job" ADD CONSTRAINT "FK_51cb12c924d3e8c7465cc8edff2" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "job" ADD CONSTRAINT "FK_b29124ef862925abf6b729236eb" FOREIGN KEY ("employer_id") REFERENCES "employer"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "job" ADD CONSTRAINT "FK_177da30403318e3e6cf960a1ead" FOREIGN KEY ("province_id") REFERENCES "province_metadata"("code") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "job" ADD CONSTRAINT "FK_15f44c4b9fbb84e28a0346e930f" FOREIGN KEY ("category_id") REFERENCES "job_category_metadata"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "job" ADD CONSTRAINT "FK_0e112d0cb745bf1861825dfcec1" FOREIGN KEY ("job_type_id") REFERENCES "job_type_metadata"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "job" DROP CONSTRAINT "FK_0e112d0cb745bf1861825dfcec1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "job" DROP CONSTRAINT "FK_15f44c4b9fbb84e28a0346e930f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "job" DROP CONSTRAINT "FK_177da30403318e3e6cf960a1ead"`,
    );
    await queryRunner.query(
      `ALTER TABLE "job" DROP CONSTRAINT "FK_b29124ef862925abf6b729236eb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "job" DROP CONSTRAINT "FK_51cb12c924d3e8c7465cc8edff2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "job_skill_tag" DROP CONSTRAINT "FK_ada5b78243b2bf23ff7e175a905"`,
    );
    await queryRunner.query(
      `ALTER TABLE "job_skill_tag" DROP CONSTRAINT "FK_22fd397967d8cf550882d819185"`,
    );
    await queryRunner.query(`DROP TABLE "job"`);
    await queryRunner.query(`DROP TABLE "job_skill_tag"`);
  }
}
