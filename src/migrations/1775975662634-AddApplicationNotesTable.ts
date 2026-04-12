import { MigrationInterface, QueryRunner } from "typeorm";

export class AddApplicationNotesTable1775975662634 implements MigrationInterface {
    name = 'AddApplicationNotesTable1775975662634'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "application_note" ("id" SERIAL NOT NULL, "application_id" integer NOT NULL, "author_id" integer NOT NULL, "content" text NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7f566bcb8dbe1afd09c325b23fe" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "application_note" ADD CONSTRAINT "FK_6f17ce8026ef2a47d6f9bda69b9" FOREIGN KEY ("application_id") REFERENCES "job_application"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "application_note" ADD CONSTRAINT "FK_9fd116a1c093195a7049de0000d" FOREIGN KEY ("author_id") REFERENCES "employer"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "application_note" DROP CONSTRAINT "FK_9fd116a1c093195a7049de0000d"`);
        await queryRunner.query(`ALTER TABLE "application_note" DROP CONSTRAINT "FK_6f17ce8026ef2a47d6f9bda69b9"`);
        await queryRunner.query(`DROP TABLE "application_note"`);
    }

}
