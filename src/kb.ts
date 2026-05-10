import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { dirname, join, resolve } from 'path';
import matter from 'gray-matter';
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

/** Determine if the knowledge base uses folder-based (articles/{slug}/) or flat layout */
function getKbLayout(knowledgeBasePath: string): 'folder' | 'flat' {
  const articlesDir = join(knowledgeBasePath, 'articles');
  return existsSync(articlesDir) && statSync(articlesDir).isDirectory() ? 'folder' : 'flat';
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

/** Write an article to the knowledge base in the appropriate layout format */
export function createArticle(options: CreateArticleOptions, knowledgeBasePath: string): { slug: string; filePath: string } {
  const slug = generateSlug(options.title);
  const layout = getKbLayout(knowledgeBasePath);

  let filePath: string;
  if (layout === 'folder') {
    const articleDir = join(knowledgeBasePath, 'articles', slug);
    mkdirSync(articleDir, { recursive: true });
    filePath = join(articleDir, 'ARTICLE.md');
  } else {
    filePath = join(knowledgeBasePath, `${slug}.md`);
    const parent = dirname(filePath);
    if (!existsSync(parent)) mkdirSync(parent, { recursive: true });
  }

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

export function readArticle(slug: string, knowledgeBasePath: string): KnowledgeBaseArticle | null {
  let filePath: string;

  // 1. Try folder-based: articles/{slug}/ARTICLE.md
  if (hasFolderArticles(knowledgeBasePath)) {
    filePath = join(getArticlesDir(knowledgeBasePath), slug, 'ARTICLE.md');
    if (existsSync(filePath)) {
      const raw = readFileSync(filePath, 'utf8');
      const parsed = matter(raw);
      const title = typeof parsed.data.title === 'string' && parsed.data.title.trim().length > 0
        ? parsed.data.title
        : slug;
      return {
        slug,
        title,
        content: parsed.content,
        tags: parseValueTags(parsed.data.tags),
        filePath,
        frontmatter: { ...parsed.data },
      };
    }
  }

  // 2. Fallback to legacy flat file at root
  filePath = join(knowledgeBasePath, `${slug}.md`);
  if (existsSync(filePath)) {
    const raw = readFileSync(filePath, 'utf8');
    const parsed = matter(raw);
    const title = typeof parsed.data.title === 'string' && parsed.data.title.trim().length > 0
      ? parsed.data.title
      : slug;
    return {
      slug,
      title,
      content: parsed.content,
      tags: parseValueTags(parsed.data.tags),
      filePath,
      frontmatter: { ...parsed.data },
    };
  }

  return null;
}

export function listArticleFiles(knowledgeBasePath: string): readonly string[] {
  if (!existsSync(knowledgeBasePath)) return [];

  if (hasFolderArticles(knowledgeBasePath)) {
    // New folder-based layout: each subfolder in articles/ has an ARTICLE.md
    const articlesDir = getArticlesDir(knowledgeBasePath);
    return readdirSync(articlesDir)
      .filter((entry) => {
        const statPath = join(articlesDir, entry);
        return statSync(statPath).isDirectory();
      })
      .map((slug) => join(articlesDir, slug, 'ARTICLE.md'))
      .filter((filePath) => existsSync(filePath));
  }

  // Legacy flat files at root
  return readdirSync(knowledgeBasePath)
    .filter((entry) => entry.endsWith('.md') && !entry.endsWith('.sidecar.md'))
    .map((entry) => join(knowledgeBasePath, entry));
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
