import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
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
    const skillMd = join(skillDir, 'SKILL.md');
    writeFileSync(skillMd, skill.skillContent, 'utf8');
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
