import { homedir } from 'os';
import { basename, dirname, join, resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { listArticleFiles, readArticle } from './kb.js';
import { parseSkillSource } from './skill-source.js';
import { writeSkillCache } from './cache.js';
import type { KnowledgeBaseSkillsConfig, SkillSourceRecord } from './types.js';

export function getDefaultKnowledgeBasePath(): string {
  return process.env.KB_SKILLS_KB_PATH ?? join(homedir(), '.pi', 'knowledge-base');
}

/**
 * Get the default cache root for materialized skills.
 * Creates `.pi/agent/skills/` in CWD for project-local install.
 * Falls back to `~/.cache/pi/kb-skills/`.
 */
export function getDefaultCacheRoot(): string {
  if (process.env.KB_SKILLS_CACHE_PATH) {
    return process.env.KB_SKILLS_CACHE_PATH;
  }

  // 1) CWD project-local (creates .pi/skills/ if needed)
  try {
    const localDir = join(process.cwd(), '.pi', 'skills');
    mkdirSync(localDir, { recursive: true });
    return localDir;
  } catch {
    // might fail if CWD is read-only, etc.
  }

  // 2) Walk up for existing .pi/skills/
  let cwd = process.cwd();
  for (let i = 0; i < 10; i++) {
    const candidate = join(cwd, '.pi', 'skills');
    if (existsSync(candidate)) return candidate;
    const parent = resolve(cwd, '..');
    if (parent === cwd) break;
    cwd = parent;
  }

  // 3) Global fallback to user's skill directory
  return join(homedir(), '.pi', 'agent', 'skills');
}

export function getKnowledgeBaseSkillsConfig(): KnowledgeBaseSkillsConfig {
  return {
    knowledgeBasePath: getDefaultKnowledgeBasePath(),
    cacheRoot: getDefaultCacheRoot(),
  };
}

export function discoverSkillSources(config: KnowledgeBaseSkillsConfig): readonly SkillSourceRecord[] {
  const records: SkillSourceRecord[] = [];
  for (const filePath of listArticleFiles(config.knowledgeBasePath)) {
    // Extract slug from path:
    //   folder-based: articles/{slug}/ARTICLE.md  → slug from parent dir
    //   legacy flat:  {slug}.md                   → slug from filename
    const folderMatch = filePath.match(/articles\/([^/]+)\/ARTICLE\.md$/);
    const slug = folderMatch ? folderMatch[1] : basename(filePath).replace(/\.md$/, '');
    if (!slug) continue;
    const article = readArticle(slug, config.knowledgeBasePath);
    if (!article) continue;
    const skill = parseSkillSource(article);
    if (skill) records.push(skill);
  }
  return records;
}

export function refreshSkillCache(config: KnowledgeBaseSkillsConfig): readonly string[] {
  const sources = discoverSkillSources(config);
  return writeSkillCache(config.cacheRoot, sources);
}
