import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateJobTypeTable1774042577195 implements MigrationInterface {
    name = 'CreateJobTypeTable1774042577195'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "job_type_metadata" ("id" SERIAL NOT NULL, "name" character varying(100) NOT NULL, "slug" character varying(100) NOT NULL, CONSTRAINT "UQ_e8b287942b42627708e420fceac" UNIQUE ("slug"), CONSTRAINT "PK_8c320d8f29b97eba6951ed5a6de" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "candidate" ADD CONSTRAINT "FK_d2d3bed68e22a32d7dabfa940f0" FOREIGN KEY ("job_type_id") REFERENCES "job_type_metadata"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "candidate" DROP CONSTRAINT "FK_d2d3bed68e22a32d7dabfa940f0"`);
        await queryRunner.query(`DROP TABLE "job_type_metadata"`);
    }

}
