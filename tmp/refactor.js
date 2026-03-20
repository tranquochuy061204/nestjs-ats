const fs = require('fs');

const svcPath = 'd:/Workspace/Projects/NestJs-ATS/src/candidates/candidates.service.ts';
let svc = fs.readFileSync(svcPath, 'utf8');

// Helper replacement
const helperSearch = `  private async findCandidateByUserId(userId: number) {
    const candidate = await this.candidateRepository.findOne({
      where: { userId },
    });`;

const helperReplace = `  async getCandidateIdOrThrow(userId: number, candidateId?: number): Promise<number> {
    if (candidateId) return candidateId;
    const candidate = await this.findCandidateByUserId(userId);
    return candidate.id;
  }

  private async findCandidateByUserId(userId: number) {
    const candidate = await this.candidateRepository.findOne({
      where: { userId },
    });`;

if (!svc.includes('getCandidateIdOrThrow')) {
    svc = svc.replace(helperSearch, helperReplace);
}

// Modify controller
const ctrlPath = 'd:/Workspace/Projects/NestJs-ATS/src/candidates/candidates.controller.ts';
let ctrl = fs.readFileSync(ctrlPath, 'utf8');

ctrl = ctrl.replace(/const user = req\.user as \{ id: number \};/g, 'const user = req.user as { id: number; candidateId?: number };');

// Let's manually replace some high value functions in Controller & Service
const targets = ['getWorkExperiences', 'getEducations', 'getProjects', 'getCertificates', 'getSkills', 'getJobCategories'];

for (const name of targets) {
  // Controller
  const ctrlRegex = new RegExp(\`return this\\.candidatesService\\.\${name}\\(user\\.id\\);\`, 'g');
  ctrl = ctrl.replace(ctrlRegex, \`return this.candidatesService.\${name}(user.id, user.candidateId);\`);
  
  // Service
  const svcRegex1 = new RegExp(\`async \${name}\\(userId: number\\) \\{\\s*const candidate = await this\\.findCandidateByUserId\\(userId\\);\\s*return this\\.([a-zA-Z]+)\\.find\\(\\{\\s*where: \\{ candidateId: candidate\\.id \\}\`, 'g');
  
  svc = svc.replace(svcRegex1, (match, p1) => {
      return \`async \${name}(userId: number, reqCandidateId?: number) {
    const cid = await this.getCandidateIdOrThrow(userId, reqCandidateId);
    return this.\${p1}.find({
      where: { candidateId: cid }\`;
  });
}

// Write back
fs.writeFileSync(svcPath, svc);
fs.writeFileSync(ctrlPath, ctrl);
console.log('Refactoring complete');
