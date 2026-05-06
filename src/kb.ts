import { existsSync, readdirSync, readFileSync } from 'fs';
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

export function readArticle(slug: string, knowledgeBasePath: string): KnowledgeBaseArticle | null {
  const filePath = join(knowledgeBasePath, `${slug}.md`);
  if (!existsSync(filePath)) return null;

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

export function listArticleFiles(knowledgeBasePath: string): readonly string[] {
  if (!existsSync(knowledgeBasePath)) return [];
  return readdirSync(knowledgeBasePath)
    .filter((entry) => entry.endsWith('.md') && !entry.endsWith('.sidecar.md'))
    .map((entry) => join(knowledgeBasePath, entry));
}
