const fs = require('fs');
const path = require('path');

const projectDir = process.cwd();
const claudeSkills = path.join(projectDir, '.claude', 'skills');
const agentsSkills = path.join(projectDir, '.agents', 'skills');

if (!fs.existsSync(claudeSkills)) {
  console.error(`[ERROR] No .claude/skills/ found in ${projectDir}`);
  process.exit(1);
}

function extractDescription(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.startsWith('#')) {
      return line.replace(/^#* */, '').trim();
    }
  }
  return 'GitNexus skill';
}

function writeSkillFile(src, destDir, skillName) {
  const prefixedName = `gitnexus-${skillName}`;
  const dest = path.join(destDir, 'SKILL.md');

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  let content = fs.readFileSync(src, 'utf8');
  let description = '';
  let body = '';

  if (content.startsWith('---')) {
    const parts = content.split('---');
    // parts[0] is empty, parts[1] is frontmatter, parts[2+] is body
    const frontmatter = parts[1];
    const descMatch = frontmatter.match(/description:\s*"?([^"\n]*)"?/);
    if (descMatch) {
      description = descMatch[1];
    } else {
      description = extractDescription(src);
    }
    body = parts.slice(2).join('---');
  } else {
    description = extractDescription(src);
    body = content;
  }

  const newSkillContent = `---
name: ${prefixedName}
description: "${description}"
---

${body.trim()}`;

  fs.writeFileSync(dest, newSkillContent);
  console.log(
    `  ✓ Synced: ${skillName} → .agents/skills/gitnexus-${skillName}/`,
  );
}

let synced = 0;

// 1. Sync flat files
if (fs.existsSync(claudeSkills)) {
  const files = fs.readdirSync(claudeSkills);
  for (const file of files) {
    if (file.endsWith('.md')) {
      const src = path.join(claudeSkills, file);
      const skillName = path.basename(file, '.md');
      const destDir = path.join(agentsSkills, `gitnexus-${skillName}`);
      writeSkillFile(src, destDir, skillName);
      synced++;
    }
  }
}

// 2. Sync generated skills
const generatedDir = path.join(claudeSkills, 'generated');
if (fs.existsSync(generatedDir)) {
  const dirs = fs.readdirSync(generatedDir);
  for (const dir of dirs) {
    const skillFile = path.join(generatedDir, dir, 'SKILL.md');
    if (fs.existsSync(skillFile)) {
      const destDir = path.join(agentsSkills, `gitnexus-${dir}`);
      writeSkillFile(skillFile, destDir, dir);
      synced++;
    }
  }
}

console.log(`\n[INFO] Synced ${synced} skill(s) to .agents/skills/`);
