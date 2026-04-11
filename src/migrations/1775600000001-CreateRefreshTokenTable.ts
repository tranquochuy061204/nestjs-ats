import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRefreshTokenTable1775600000001 implements MigrationInterface {
  name = 'CreateRefreshTokenTable1775600000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "refresh_token" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" integer NOT NULL, "token" text NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "isRevoked" boolean NOT NULL DEFAULT false, "userAgent" character varying(512), "ipAddress" character varying(50), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b575dd3c21fb0831013c909e7fe" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_c31d0a2f38e6e99110df62ab0a" ON "refresh_token" ("token") `,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_token" DROP CONSTRAINT IF EXISTS "FK_8e913e288156c133999341156ad"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_token" ADD CONSTRAINT "FK_8e913e288156c133999341156ad" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "refresh_token" DROP CONSTRAINT "FK_8e913e288156c133999341156ad"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c31d0a2f38e6e99110df62ab0a"`,
    );
    await queryRunner.query(`DROP TABLE "refresh_token"`);
  }
}
