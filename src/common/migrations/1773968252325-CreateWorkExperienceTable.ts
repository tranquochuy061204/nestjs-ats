import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWorkExperienceTable1773968252325 implements MigrationInterface {
  name = 'CreateWorkExperienceTable1773968252325';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "work_experience" ("id" SERIAL NOT NULL, "candidate_id" integer NOT NULL, "company_name" character varying(255) NOT NULL, "position" character varying(255) NOT NULL, "start_date" date, "end_date" date, "is_working_here" boolean, "description" text, CONSTRAINT "PK_d4bef63ad6da7ec327515c121bd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "work_experience" ADD CONSTRAINT "FK_4d542165035a792e0972754a153" FOREIGN KEY ("candidate_id") REFERENCES "candidate"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "work_experience" DROP CONSTRAINT "FK_4d542165035a792e0972754a153"`,
    );
    await queryRunner.query(`DROP TABLE "work_experience"`);
  }
}
