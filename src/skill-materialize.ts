import { mkdirSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import matter from 'gray-matter';
import { readArticle } from './kb.js';
import { getDefaultKnowledgeBasePath } from './loader.js';
import type { MaterializeSkillOptions, MaterializeSkillResult } from './types.js';
import { parseSkillSource } from './skill-source.js';

/**
 * Resolve the install target directory based on scope.
 * Local → `<cwd>/.pi/agent/skills/`
 * Global → `~/.pi/agent/skills/`
 */
export function resolveInstallDir(scope: 'local' | 'global'): string {
  if (scope === 'global') {
    const dir = join(homedir(), '.pi', 'agent', 'skills');
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  // local — project .pi/agent/skills/
  const dir = join(process.cwd(), '.pi', 'agent', 'skills');
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function executeMaterializeSkill(options: MaterializeSkillOptions): MaterializeSkillResult {
  try {
    const knowledgeBasePath = getDefaultKnowledgeBasePath();
    const article = readArticle(options.articleSlug, knowledgeBasePath);
    if (!article) {
      return { success: false, error: `Article not found: ${options.articleSlug}` };
    }

    // Accept disabled skills too — user is explicitly installing
    const skill = parseSkillSource(article, { allowDisabled: true });
    if (!skill) {
      return { success: false, error: `Article "${options.articleSlug}" is not a valid skill-source article` };
    }

    const scope = options.scope ?? 'local';
    const targetDir = resolveInstallDir(scope);
    const skillDir = join(targetDir, skill.skillName);
    mkdirSync(skillDir, { recursive: true });

    // Ensure the SKILL.md has valid frontmatter with name and description
    const parsed = matter(skill.skillContent.trimStart());
    const hasName = typeof parsed.data.name === 'string' && parsed.data.name.length > 0;
    const hasDescription = typeof parsed.data.description === 'string' && parsed.data.description.trim().length > 0;

    let finalContent: string;
    if (hasName && hasDescription) {
      // Already has proper frontmatter
      finalContent = skill.skillContent;
    } else {
      // Prepend frontmatter from the KB article metadata
      finalContent = [
        '---',
        `name: ${skill.skillName}`,
        `description: ${skill.skillDescription}`,
        '---',
        '',
        skill.skillContent,
      ].join('\n');
    }

    // Write SKILL.md
    const skillMdPath = join(skillDir, 'SKILL.md');
    writeFileSync(skillMdPath, finalContent, 'utf8');

    // Write SOURCE.json linking back to the KB article
    const sourceJsonPath = join(skillDir, 'SOURCE.json');
    writeFileSync(sourceJsonPath, JSON.stringify({
      skillName: skill.skillName,
      skillRef: skill.article.tags.find((t) => t.key === 'skill_ref')?.value,
      articleSlug: skill.article.slug,
      articlePath: skill.article.filePath,
      materializedAt: new Date().toISOString(),
    }, null, 2) + '\n', 'utf8');

    return {
      success: true,
      outputPath: skillDir,
      skillName: skill.skillName,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export function formatMaterializeSkillResult(result: MaterializeSkillResult): string {
  if (!result.success) {
    return `Error materializing skill: ${result.error}`;
  }

  return [
    `Materialized skill: ${result.skillName}`,
    `  Output: ${result.outputPath}/SKILL.md`,
  ].join('\n');
}
