import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { refreshSkillCache, getKnowledgeBaseSkillsConfig } from './loader.js';

export default function registerKnowledgeBaseSkills(pi: ExtensionAPI) {
  (pi as any).on('resources_discover', async () => {
    const config = getKnowledgeBaseSkillsConfig();
    const skillPaths = refreshSkillCache(config);
    return { skillPaths };
  });
}
