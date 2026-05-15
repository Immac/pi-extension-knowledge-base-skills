import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join, resolve } from 'path';
import matter from 'gray-matter';

// Import from the main knowledge-base extension for consistent path resolution and read logic.
// This ensures the skills extension always uses the same folder-per-article layout and
// file format as the core KB tools (kb-read, kb-list, etc.).
import { readArticle as kbReadArticle, listArticles as kbListArticles } from '../../knowledge-base/dist/storage.js';
import { getArticleMainPath } from '../../knowledge-base/dist/config.js';

import type { CreateArticleOptions, KnowledgeBaseArticle, ValueTag } from './types.js';

function parseTagString(tag: string): ValueTag | null {
  const index = tag.indexOf(':');
  if (index === -1) return null;
  const key = tag.slice(0, index).trim();
  const value = tag.slice(index + 1).trim();
  if (!key || !value) return null;
  return { key, value };
}

function parseValueTags(tags: unknown): readonly ValueTag[] {
  if (!tags) return [];

  if (Array.isArray(tags)) {
    const parsed: ValueTag[] = [];
    for (const tag of tags) {
      if (typeof tag === 'string') {
        const parsedTag = parseTagString(tag);
        if (parsedTag) parsed.push(parsedTag);
      } else if (tag && typeof tag === 'object') {
        for (const [key, value] of Object.entries(tag as Record<string, unknown>)) {
          if (typeof value === 'string') parsed.push({ key, value });
        }
      }
    }
    return parsed;
  }

  if (typeof tags === 'object') {
    const parsed: ValueTag[] = [];
    for (const [key, value] of Object.entries(tags as Record<string, unknown>)) {
      if (typeof value === 'string') {
        parsed.push({ key, value });
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string') parsed.push({ key, value: item });
        }
      }
    }
    return parsed;
  }

  return [];
}

/** Serialize an article to markdown with frontmatter in KB format.
 *  Unlike gray-matter.stringify, this does NOT merge embedded frontmatter
 *  from the content — it preserves the content as-is after the outer frontmatter,
 *  which is essential for skill-source articles that have their own inner frontmatter. */
export function serializeArticle(options: CreateArticleOptions): string {
  const tags = options.tags.map((tag) => `${tag.key}:${tag.value}`);
  const lines: string[] = ['---'];
  lines.push(`title: ${options.title}`);
  if (tags.length > 0) {
    lines.push('tags:');
    for (const tag of tags) {
      lines.push(`  - ${JSON.stringify(tag)}`);
    }
  }
  lines.push(`created: ${(options.created ?? new Date()).toISOString()}`);
  lines.push(`modified: ${(options.modified ?? new Date()).toISOString()}`);
  lines.push('---');
  const body = options.content ?? '';
  if (body) {
    lines.push('');
    lines.push(body.trimEnd());
  }
  lines.push('');
  return lines.join('\n');
}

/** Generate a kebab-case slug from a title */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

/**
 * Create an article in the knowledge base using the folder-per-article layout
 * (articles/{slug}/ARTICLE.md), which matches the main KB extension's layout.
 * Uses custom serialization to preserve inner frontmatter in the body content.
 */
export function createArticle(options: CreateArticleOptions, knowledgeBasePath: string): { slug: string; filePath: string } {
  const slug = generateSlug(options.title);
  const articleDir = join(knowledgeBasePath, 'articles', slug);
  mkdirSync(articleDir, { recursive: true });
  const filePath = join(articleDir, 'ARTICLE.md');

  const content = serializeArticle(options);
  writeFileSync(filePath, content, 'utf8');
  return { slug, filePath };
}

/** Path to the articles/ subfolder within a knowledge base */
function getArticlesDir(knowledgeBasePath: string): string {
  return join(knowledgeBasePath, 'articles');
}

/** True if the knowledge base uses the new folder-per-article layout */
function hasFolderArticles(knowledgeBasePath: string): boolean {
  const dir = getArticlesDir(knowledgeBasePath);
  return existsSync(dir) && statSync(dir).isDirectory();
}

/**
 * Read an article from the knowledge base.
 * Delegates to the main KB extension's readArticle for folder/flat fallback,
 * then enriches with raw frontmatter needed by skill parsing.
 */
export function readArticle(slug: string, knowledgeBasePath: string): KnowledgeBaseArticle | null {
  // Build a config object matching what the main KB extension expects
  const config = { dataPath: knowledgeBasePath, isLocal: true };
  const article = kbReadArticle(slug, config);
  if (!article) return null;

  // Read raw frontmatter from the ARTICLE.md file (the main KB doesn't surface this directly)
  let frontmatter: Record<string, unknown> = {};
  const mainPath = getArticleMainPath(knowledgeBasePath, slug);
  if (existsSync(mainPath)) {
    try {
      const raw = readFileSync(mainPath, 'utf8');
      const parsed = matter(raw);
      frontmatter = parsed.data as Record<string, unknown>;
    } catch {
      // Fall back to empty frontmatter
    }
  }

  return {
    slug: article.slug,
    title: article.title,
    content: article.content,
    tags: article.tags,
    filePath: article.filePath,
    frontmatter,
  };
}

/**
 * List all article file paths in a knowledge base.
 * Delegates to the main KB extension's listArticles for consistent layout handling.
 */
export function listArticleFiles(knowledgeBasePath: string): readonly string[] {
  const config = { dataPath: knowledgeBasePath, isLocal: true };

  // listArticles auto-migrates legacy flat files and returns all articles
  try {
    const articles = kbListArticles(config);
    return articles.map((a) => a.filePath);
  } catch {
    // Fallback: if the KB doesn't exist yet, return empty
    if (!existsSync(knowledgeBasePath)) return [];

    // Manual fallback for flat-layout KBs that haven't been migrated
    if (hasFolderArticles(knowledgeBasePath)) {
      const articlesDir = getArticlesDir(knowledgeBasePath);
      return readdirSync(articlesDir)
        .filter((entry) => {
          const statPath = join(articlesDir, entry);
          return statSync(statPath).isDirectory();
        })
        .map((slug) => join(articlesDir, slug, 'ARTICLE.md'))
        .filter((filePath) => existsSync(filePath));
    }

    return readdirSync(knowledgeBasePath)
      .filter((entry) => entry.endsWith('.md') && !entry.endsWith('.sidecar.md'))
      .map((entry) => join(knowledgeBasePath, entry));
  }
}

/** Resolve the knowledge base data path for a given scope.
 *  Respects KB_SKILLS_KB_PATH env var — when set, it overrides both local and global. */
export function resolveKbPath(scope: 'local' | 'global'): string {
  const envPath = process.env.KB_SKILLS_KB_PATH;
  if (envPath) return resolve(envPath);
  if (scope === 'local') {
    return resolve('./knowledge-base');
  }
  return resolve(homedir(), '.pi', 'knowledge-base');
}
