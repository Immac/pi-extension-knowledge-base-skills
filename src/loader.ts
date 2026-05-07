import { homedir } from 'os';
import { basename, dirname, join } from 'path';
import { listArticleFiles, readArticle } from './kb.js';
import { parseSkillSource } from './skill-source.js';
import { writeSkillCache } from './cache.js';
import type { KnowledgeBaseSkillsConfig, SkillSourceRecord } from './types.js';

export function getDefaultKnowledgeBasePath(): string {
  return process.env.KB_SKILLS_KB_PATH ?? join(homedir(), '.pi', 'knowledge-base');
}

export function getDefaultCacheRoot(): string {
  return process.env.KB_SKILLS_CACHE_PATH ?? join(homedir(), '.cache', 'pi', 'kb-skills');
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
