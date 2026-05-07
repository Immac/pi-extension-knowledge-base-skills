import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';
import type { KnowledgeBaseArticle, ValueTag } from './types.js';

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
