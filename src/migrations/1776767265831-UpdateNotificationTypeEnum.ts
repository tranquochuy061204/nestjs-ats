import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateNotificationTypeEnum1776767265831 implements MigrationInterface {
    name = 'UpdateNotificationTypeEnum1776767265831'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."notification_type_enum" AS ENUM('application_status', 'headhunt_invitation', 'headhunt_accept', 'headhunt_reject', 'job_approval', 'job_rejection', 'new_note', 'system')`);
        await queryRunner.query(`ALTER TABLE "notification" ALTER COLUMN "type" TYPE "public"."notification_type_enum" USING "type"::"text"::"public"."notification_type_enum"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification" ALTER COLUMN "type" TYPE character varying(50) USING "type"::"text"`);
        await queryRunner.query(`DROP TYPE "public"."notification_type_enum"`);
    }

}
