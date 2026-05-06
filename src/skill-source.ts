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

export function parseSkillSource(article: KnowledgeBaseArticle): SkillSourceRecord | null {
  const requiredTags = [
    ['type', 'skill'],
    ['kind', 'skill-source'],
    ['skill', 'enabled'],
  ] as const;

  for (const [key, value] of requiredTags) {
    if (!hasTag(article.tags, key, value)) {
      return null;
    }
  }

  const skillRef = getTagValue(article.tags, 'skill_ref');
  const skillName = getTagValue(article.tags, 'skill_name');
  if (!skillRef || !skillName || !isSkillNameValid(skillName)) {
    return null;
  }

  const parsed = matter(article.content.trimStart());
  const skillFrontmatter = parsed.data as { name?: unknown; description?: unknown };
  const embeddedName = typeof skillFrontmatter.name === 'string' ? skillFrontmatter.name : '';
  const embeddedDescription = typeof skillFrontmatter.description === 'string' ? skillFrontmatter.description : '';
  const body = parsed.content.trim();

  if (!isSkillNameValid(embeddedName) || embeddedName !== skillName) {
    return null;
  }

  if (!embeddedDescription.trim() || !body) {
    return null;
  }

  return {
    article,
    skillName,
    skillDescription: embeddedDescription,
    skillContent: article.content.trimStart(),
  };
}
