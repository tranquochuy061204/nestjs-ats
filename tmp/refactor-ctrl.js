const fs = require('fs');
const file = 'd:/Workspace/Projects/NestJs-ATS/src/candidates/candidates.controller.ts';
let content = fs.readFileSync(file, 'utf8');

// 1. Replace imports
content = content.replace(
  "import { CandidatesService } from './candidates.service';",
  "import { CandidateProfileService } from './services/candidate-profile.service';\nimport { CandidateExperienceService } from './services/candidate-experience.service';\nimport { CandidateSkillsService } from './services/candidate-skills.service';\nimport { CandidateCertificatesService } from './services/candidate-certificates.service';"
);

// 2. Replace constructor
content = content.replace(
  "  constructor(private readonly candidatesService: CandidatesService) {}",
  "  constructor(\n    private readonly profileService: CandidateProfileService,\n    private readonly experienceService: CandidateExperienceService,\n    private readonly skillsService: CandidateSkillsService,\n    private readonly certificatesService: CandidateCertificatesService,\n  ) {}"
);

// 3. Replace method calls
const profileMethods = ['getProfile', 'updateProfile', 'uploadCv'];
const experienceMethods = ['getWorkExperiences', 'createWorkExperience', 'updateWorkExperience', 'deleteWorkExperience', 'getEducations', 'createEducation', 'updateEducation', 'deleteEducation', 'getProjects', 'createProject', 'updateProject', 'deleteProject'];
const certificateMethods = ['getCertificates', 'createCertificate', 'updateCertificate', 'deleteCertificate'];
const skillMethods = ['getSkills', 'addSkills', 'deleteSkill', 'getJobCategories', 'addJobCategories', 'deleteJobCategory', 'getJobTypes'];

profileMethods.forEach(m => { content = content.replace(new RegExp('this\\.candidatesService\\.' + m, 'g'), 'this.profileService.' + m); });
experienceMethods.forEach(m => { content = content.replace(new RegExp('this\\.candidatesService\\.' + m, 'g'), 'this.experienceService.' + m); });
certificateMethods.forEach(m => { content = content.replace(new RegExp('this\\.candidatesService\\.' + m, 'g'), 'this.certificatesService.' + m); });
skillMethods.forEach(m => { content = content.replace(new RegExp('this\\.candidatesService\\.' + m, 'g'), 'this.skillsService.' + m); });

fs.writeFileSync(file, content);
console.log('Controller refactored');
