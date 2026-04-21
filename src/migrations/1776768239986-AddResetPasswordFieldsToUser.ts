import { MigrationInterface, QueryRunner } from "typeorm";

export class AddResetPasswordFieldsToUser1776768239986 implements MigrationInterface {
    name = 'AddResetPasswordFieldsToUser1776768239986'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "reset_password_token" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "user" ADD "reset_password_expires" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "reset_password_expires"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "reset_password_token"`);
    }

}
