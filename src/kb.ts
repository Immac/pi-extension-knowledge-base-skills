import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join, resolve } from 'path';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';

// Import from the main knowledge-base extension for consistent path resolution and read logic.
import { readArticle as kbReadArticle, listArticles as kbListArticles } from '../../knowledge-base/dist/storage.js';
import { getArticleTomlPath } from '../../knowledge-base/dist/config.js';

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

/** Serialize an article to TOML format. */
export function serializeArticle(options: CreateArticleOptions): string {
  const slug = options.title
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');

  const doc: Record<string, unknown> = {
    meta: {
      title: options.title,
      slug,
      created: (options.created ?? new Date()).toISOString(),
      modified: (options.modified ?? new Date()).toISOString(),
    },
    tags: options.tags.map((tag) => ({ key: tag.key, value: tag.value })),
    body: [
      {
        type: 'text' as const,
        markdown: options.content ?? '',
      },
    ],
  };

  return stringifyToml(doc);
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
 * Create an article in the knowledge base using TOML format.
 */
export function createArticle(options: CreateArticleOptions, knowledgeBasePath: string): { slug: string; filePath: string } {
  const slug = generateSlug(options.title);
  const articleDir = join(knowledgeBasePath, 'articles', slug);
  mkdirSync(articleDir, { recursive: true });
  const filePath = getArticleTomlPath(knowledgeBasePath, slug);

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
 * Delegates to the main KB extension's readArticle,
 * then enriches with raw TOML metadata needed by skill parsing.
 */
export function readArticle(slug: string, knowledgeBasePath: string): KnowledgeBaseArticle | null {
  // Build a config object matching what the main KB extension expects
  const config = { dataPath: knowledgeBasePath, isLocal: true };
  const article = kbReadArticle(slug, config);
  if (!article) return null;

  // Read raw TOML metadata (the main KB doesn't surface this directly)
  let frontmatter: Record<string, unknown> = {};
  const tomlPath = getArticleTomlPath(knowledgeBasePath, slug);
  if (existsSync(tomlPath)) {
    try {
      const raw = readFileSync(tomlPath, 'utf8');
      const parsed = parseToml(raw) as Record<string, unknown>;
      const meta = (parsed.meta ?? {}) as Record<string, unknown>;
      const tagsRaw = (parsed.tags ?? []) as unknown[];
      frontmatter = {
        title: meta.title,
        slug: meta.slug,
        tags: tagsRaw.map((t) => {
          const tag = t as Record<string, unknown>;
          return `${tag.key}:${tag.value}`;
        }),
        created: meta.created,
        modified: meta.modified,
      };
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

    // Manual fallback for KBs that haven't been loaded via main extension
    if (hasFolderArticles(knowledgeBasePath)) {
      const articlesDir = getArticlesDir(knowledgeBasePath);
      return readdirSync(articlesDir)
        .filter((entry) => {
          const statPath = join(articlesDir, entry);
          return statSync(statPath).isDirectory();
        })
        .map((slug) => join(articlesDir, slug, 'ARTICLE.toml'))
        .filter((filePath) => existsSync(filePath));
    }

    return [];
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
