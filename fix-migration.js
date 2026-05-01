const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src/migrations');
const files = fs.readdirSync(dir).filter(f => f.includes('1777666822285'));

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace DROP + ADD with ALTER COLUMN TYPE for Up
  content = content.replace(
    /await queryRunner\.query\(`ALTER TABLE "([^"]+)" DROP COLUMN "([^"]+)"`\);\s*await queryRunner\.query\(`ALTER TABLE "\1" ADD "\2" (TIMESTAMP[^`]*)`\);/g,
    'await queryRunner.query(`ALTER TABLE "$1" ALTER COLUMN "$2" TYPE TIMESTAMP WITH TIME ZONE USING "$2"::timestamp with time zone`);'
  );

  // Replace DROP + ADD with ALTER COLUMN TYPE for Down
  content = content.replace(
    /await queryRunner\.query\(`ALTER TABLE "([^"]+)" DROP COLUMN "([^"]+)"`\);\s*await queryRunner\.query\(`ALTER TABLE "\1" ADD "\2" (TIMESTAMP[^`]*)`\);/g,
    'await queryRunner.query(`ALTER TABLE "$1" ALTER COLUMN "$2" TYPE TIMESTAMP WITHOUT TIME ZONE USING "$2"::timestamp without time zone`);'
  );

  fs.writeFileSync(filePath, content);
  console.log(`Fixed migration ${file}`);
}
