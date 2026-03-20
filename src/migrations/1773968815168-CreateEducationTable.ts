import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateEducationTable1773968815168 implements MigrationInterface {
    name = 'CreateEducationTable1773968815168'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "education" ("id" SERIAL NOT NULL, "candidate_id" integer NOT NULL, "school_name" character varying(255) NOT NULL, "major" character varying(255), "degree" character varying(100), "start_date" date, "end_date" date, "is_still_studying" boolean, "description" text, CONSTRAINT "PK_bf3d38701b3030a8ad634d43bd6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "education" ADD CONSTRAINT "FK_e5cd2741ebeb6c59b192cafcc94" FOREIGN KEY ("candidate_id") REFERENCES "candidate"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "education" DROP CONSTRAINT "FK_e5cd2741ebeb6c59b192cafcc94"`);
        await queryRunner.query(`DROP TABLE "education"`);
    }

}
