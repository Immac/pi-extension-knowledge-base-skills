import matter from 'gray-matter';
import type { KnowledgeBaseArticle, SkillSourceRecord, ValueTag } from './types.js';

function hasTag(tags: readonly ValueTag[], key: string, value: string): boolean {
  return tags.some((tag) => tag.key === key && tag.value === value);
}

function getTagValue(tags: readonly ValueTag[], key: string): string | undefined {
  return tags.find((tag) => tag.key === key)?.value;
}

function isSkillNameValid(name: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) && name.length <= 64;
}

/**
 * Try to read skill metadata from the article's body (inner frontmatter).
 * Returns { name, description, body } or null.
 */
function tryInnerFrontmatter(content: string, skillName: string): { name: string; description: string; content: string } | null {
  const parsed = matter(content.trimStart());
  const frontmatter = parsed.data as { name?: unknown; description?: unknown };
  const embeddedName = typeof frontmatter.name === 'string' ? frontmatter.name : '';
  const embeddedDescription = typeof frontmatter.description === 'string' ? frontmatter.description : '';

  if (isSkillNameValid(embeddedName) && embeddedName === skillName && embeddedDescription.trim()) {
    return { name: embeddedName, description: embeddedDescription, content: content.trimStart() };
  }
  return null;
}

/**
 * Try to read skill metadata from the article's outer frontmatter.
 * Checks raw frontmatter fields (description) and falls back to title.
 */
function tryOuterFrontmatter(article: KnowledgeBaseArticle, skillName: string, tagDescription: string): { name: string; description: string; content: string } | null {
  if (!isSkillNameValid(skillName)) return null;

  // Prefer raw frontmatter.description, then tag description, then title
  const rawDesc = typeof article.frontmatter.description === 'string' ? article.frontmatter.description.trim() : '';
  const description = rawDesc || tagDescription || article.title;
  if (!description.trim()) return null;

  return { name: skillName, description, content: article.content.trimStart() };
}

export interface ParseSkillSourceOptions {
  /** Allow parsing disabled skill-source articles too (for explicit install). Default: false. */
  allowDisabled?: boolean;
}

export function parseSkillSource(article: KnowledgeBaseArticle, options?: ParseSkillSourceOptions): SkillSourceRecord | null {
  const requiredTags: readonly (readonly [string, string])[] = [
    ['type', 'skill'],
    ['kind', 'skill-source'],
  ];

  for (const [key, value] of requiredTags) {
    if (!hasTag(article.tags, key, value)) {
      return null;
    }
  }

  // For auto-discovery, require skill:enabled. For explicit install, accept disabled too.
  if (!options?.allowDisabled) {
    if (!hasTag(article.tags, 'skill', 'enabled')) {
      return null;
    }
  }

  const skillRef = getTagValue(article.tags, 'skill_ref');
  const skillName = getTagValue(article.tags, 'skill_name');
  if (!skillRef || !skillName || !isSkillNameValid(skillName)) {
    return null;
  }

  // Check outer frontmatter for description tag
  const outerDescription = getTagValue(article.tags, 'description') ?? '';

  // First try inner frontmatter (embedded --- frontmatter in the body)
  const innerResult = tryInnerFrontmatter(article.content, skillName);
  if (innerResult) {
    return {
      article,
      skillName,
      skillDescription: innerResult.description,
      skillContent: innerResult.content,
    };
  }

  // Fallback to outer frontmatter (name/description from article tags)
  const outerResult = tryOuterFrontmatter(article, skillName, outerDescription);
  if (outerResult) {
    return {
      article,
      skillName,
      skillDescription: outerResult.description,
      skillContent: outerResult.content,
    };
  }

  return null;
}
