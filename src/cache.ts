import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';
import type { SkillSourceRecord } from './types.js';

function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

export function prepareSkillCache(cacheRoot: string): void {
  rmSync(cacheRoot, { recursive: true, force: true });
  ensureDir(cacheRoot);
}

export function writeSkillCache(cacheRoot: string, skills: readonly SkillSourceRecord[]): readonly string[] {
  prepareSkillCache(cacheRoot);

  const generatedPaths: string[] = [];
  for (const skill of skills) {
    const skillDir = join(cacheRoot, skill.skillName);
    ensureDir(skillDir);

    // Ensure the SKILL.md has valid frontmatter with name and description
    const parsed = matter(skill.skillContent.trimStart());
    const hasName = typeof parsed.data.name === 'string' && parsed.data.name.length > 0;
    const hasDescription = typeof parsed.data.description === 'string' && parsed.data.description.trim().length > 0;

    let finalContent: string;
    if (hasName && hasDescription) {
      finalContent = skill.skillContent;
    } else {
      finalContent = [
        '---',
        `name: ${skill.skillName}`,
        `description: ${skill.skillDescription}`,
        '---',
        '',
        skill.skillContent,
      ].join('\n');
    }

    const skillMd = join(skillDir, 'SKILL.md');
    writeFileSync(skillMd, finalContent, 'utf8');
    writeFileSync(
      join(skillDir, 'SOURCE.json'),
      JSON.stringify(
        {
          skillName: skill.skillName,
          skillRef: skill.article.tags.find((tag) => tag.key === 'skill_ref')?.value,
          articleSlug: skill.article.slug,
          articlePath: skill.article.filePath,
        },
        null,
        2
      ) + '\n',
      'utf8'
    );
    generatedPaths.push(skillDir);
  }

  return generatedPaths;
}

export function listCachedSkills(cacheRoot: string): readonly string[] {
  try {
    return readdirSync(cacheRoot).map((entry) => join(cacheRoot, entry));
  } catch {
    return [];
  }
}
