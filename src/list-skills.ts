import { listArticleFiles, readArticle, resolveKbPath } from './kb.js';
import type { KnowledgeBaseArticle, ValueTag } from './types.js';

export interface SkillIssue {
  readonly field: string;
  readonly severity: 'error' | 'warning';
  readonly message: string;
}

export interface ListedSkill {
  readonly slug: string;
  readonly title: string;
  readonly skillName: string;
  readonly skillRef: string;
  readonly enabled: boolean;
  readonly description: string;
  readonly scope: 'local' | 'global';
  readonly issues: readonly SkillIssue[];
  readonly isQualified: boolean;
}

export interface ListSkillsOptions {
  readonly scope?: 'local' | 'global' | 'all';
  readonly status?: 'enabled' | 'disabled' | 'all';
  readonly verbose?: boolean;
}

export interface ListSkillsResult {
  readonly skills: readonly ListedSkill[];
}

export function executeListSkills(options: ListSkillsOptions): ListSkillsResult {
  const results: ListedSkill[] = [];

  const scopes: ('local' | 'global')[] = options.scope === 'all' || !options.scope
    ? ['local', 'global']
    : [options.scope];

  const seenPaths = new Set<string>();
  for (const scope of scopes) {
    const kbPath = resolveKbPath(scope);
    // Deduplicate: if both scopes resolve to same path (e.g., env var override), skip
    if (seenPaths.has(kbPath)) continue;
    seenPaths.add(kbPath);
    const articleFiles = listArticleFiles(kbPath);

    for (const filePath of articleFiles) {
      // Extract slug from path
      const folderMatch = filePath.match(/articles\/([^/]+)\/ARTICLE\.(toml|md)$/);
      const slug = folderMatch ? folderMatch[1] : filePath.split('/').pop()?.replace(/\.(toml|md)$/, '') ?? '';
      if (!slug) continue;

      const article = readArticle(slug, kbPath);
      if (!article) continue;

      // Skip non-skill articles
      const typeTag = getTagValue(article.tags, 'type');
      const kindTag = getTagValue(article.tags, 'kind');
      if (typeTag !== 'skill' || kindTag !== 'skill-source') continue;

      const skillName = getTagValue(article.tags, 'skill_name') ?? slug;
      const skillRef = getTagValue(article.tags, 'skill_ref') ?? '';
      const enabled = hasTag(article.tags, 'skill', 'enabled');

      // Extract description from inner or outer frontmatter
      const description = extractDescription(article);

      // Filter by status
      if (options.status === 'enabled' && !enabled) continue;
      if (options.status === 'disabled' && enabled) continue;

      const issues = validateSkillArticle(article);
      const isQualified = issues.filter((i) => i.severity === 'error').length === 0;

      results.push({
        slug,
        title: article.title,
        skillName,
        skillRef,
        enabled,
        description: description || '(no description)',
        scope,
        issues,
        isQualified,
      });
    }
  }

  return { skills: results };
}

const REQUIRED_TAGS: readonly { key: string; value: string; description: string }[] = [
  { key: 'type', value: 'skill', description: 'Marks the article as a skill definition' },
  { key: 'kind', value: 'skill-source', description: 'Distinguishes skill sources from doc articles' },
  { key: 'skill', value: '', description: 'Opt-in flag (enabled or disabled)' },
  { key: 'skill_ref', value: '', description: 'Unique reference identifier for the skill' },
  { key: 'skill_name', value: '', description: 'Runtime name for cache dir and SKILL.md' },
  { key: 'audience', value: 'agent', description: 'Marks as machine-oriented' },
  { key: 'format', value: 'agent-skill', description: 'Content format' },
  { key: 'source', value: '', description: 'Origin tracking' },
];

function isSkillNameValid(name: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) && name.length <= 64;
}

function getTagValue(tags: readonly ValueTag[], key: string): string | undefined {
  for (const tag of tags) {
    if (tag.key === key) return tag.value;
  }
  return undefined;
}

function hasTag(tags: readonly ValueTag[], key: string, value: string): boolean {
  return tags.some((tag) => tag.key === key && tag.value === value);
}

/** Parse inner frontmatter (embedded --- block) from article body content */
function parseInnerFrontmatter(content: string): { name: string; description: string } {
  let name = '';
  let description = '';
  const trimmed = content.trimStart();
  if (trimmed.startsWith('---')) {
    const endIndex = trimmed.indexOf('---', 3);
    if (endIndex !== -1) {
      const innerRaw = trimmed.slice(3, endIndex).trim();
      for (const line of innerRaw.split('\n')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) continue;
        const key = line.slice(0, colonIdx).trim();
        const val = line.slice(colonIdx + 1).trim().replace(/^['"]|['"]$/g, '');
        if (key === 'name' && val) name = val;
        if (key === 'description' && val) description = val;
      }
    }
  }
  return { name, description };
}

/** Extract description from article, preferring inner frontmatter over outer */
function extractDescription(article: KnowledgeBaseArticle): string {
  const inner = parseInnerFrontmatter(article.content);
  if (inner.description) return inner.description;
  const outerDesc = typeof article.frontmatter.description === 'string' ? article.frontmatter.description : '';
  if (outerDesc) return outerDesc;
  return '';
}

function validateSkillArticle(article: KnowledgeBaseArticle): readonly SkillIssue[] {
  const issues: SkillIssue[] = [];
  const { tags, frontmatter, content } = article;

  // Check required tags
  for (const req of REQUIRED_TAGS) {
    const tagValue = getTagValue(tags, req.key);
    if (!tagValue) {
      issues.push({
        field: `tag:${req.key}`,
        severity: 'error',
        message: `Missing required tag "${req.key}"${req.value ? ` with value "${req.value}"` : ''} (${req.description})`,
      });
    } else if (req.value && tagValue !== req.value) {
      issues.push({
        field: `tag:${req.key}`,
        severity: 'warning',
        message: `Tag "${req.key}" has value "${tagValue}", expected "${req.value}"`,
      });
    }
  }

  // Validate skill_name format
  const skillName = getTagValue(tags, 'skill_name');
  if (skillName && !isSkillNameValid(skillName)) {
    issues.push({
      field: 'tag:skill_name',
      severity: 'error',
      message: `skill_name "${skillName}" is not valid kebab-case (lowercase, hyphens only, max 64 chars)`,
    });
  }

  // Check inner frontmatter
  const inner = parseInnerFrontmatter(content);
  const innerName = inner.name;
  const innerDescription = inner.description;

  // Check outer frontmatter fallback
  const outerName = typeof frontmatter.name === 'string' ? frontmatter.name : '';
  const outerDescription = typeof frontmatter.description === 'string' ? frontmatter.description : '';

  const hasInnerFrontmatter = !!(innerName && innerDescription);
  const hasOuterFrontmatter = !!(outerName || outerDescription);

  // Check name match
  const effectiveName = innerName || outerName;
  if (!effectiveName) {
    issues.push({
      field: 'name',
      severity: 'error',
      message: 'No skill name found — missing in both inner frontmatter (embedded --- block) and outer article frontmatter',
    });
  } else if (skillName && effectiveName !== skillName) {
    issues.push({
      field: 'name',
      severity: 'error',
      message: `Skill name "${effectiveName}" does not match skill_name tag "${skillName}"`,
    });
  }

  // Check description
  const effectiveDescription = innerDescription || outerDescription;
  if (!effectiveDescription) {
    issues.push({
      field: 'description',
      severity: 'error',
      message: 'No description found — missing in both inner and outer frontmatter',
    });
  }

  // Check body content
  const bodyContent = content.trim();
  if (!bodyContent) {
    issues.push({
      field: 'content',
      severity: 'error',
      message: 'Article body is empty',
    });
  }

  // Check inner vs outer frontmatter consistency
  if (!hasInnerFrontmatter && !hasOuterFrontmatter) {
    issues.push({
      field: 'frontmatter',
      severity: 'error',
      message: 'Neither inner embedded frontmatter nor outer article frontmatter has name+description',
    });
  } else if (hasOuterFrontmatter && !hasInnerFrontmatter) {
    issues.push({
      field: 'frontmatter',
      severity: 'warning',
      message: 'Using outer article frontmatter for name/description — inner embedded frontmatter is preferred for skill-source articles',
    });
  }

  return issues;
}

export function formatListSkillsResult(result: ListSkillsResult, verbose?: boolean): string {
  const { skills } = result;

  if (skills.length === 0) {
    return 'No skill-source articles found in the knowledge base.';
  }

  const lines: string[] = [
    `Found ${skills.length} skill-source article(s):`,
    '',
  ];

  for (let i = 0; i < skills.length; i++) {
    const s = skills[i];
    const statusIcon = s.enabled ? '✅' : '⛔';
    const qualifiedIcon = s.isQualified ? '✓' : '✗';
    lines.push(`  ${statusIcon} [${qualifiedIcon}] ${s.skillName} (${s.scope})`);
    lines.push(`       Slug: ${s.slug}`);
    lines.push(`       Description: ${s.description.length > 80 ? s.description.slice(0, 80) + '…' : s.description}`);
    lines.push(`       Ref: ${s.skillRef}`);
    lines.push(`       Status: ${s.enabled ? 'enabled' : 'disabled'}`);

    if (s.issues.length > 0 && verbose) {
      for (const issue of s.issues) {
        const icon = issue.severity === 'error' ? '🔴' : '🟡';
        lines.push(`       ${icon} [${issue.field}] ${issue.message}`);
      }
    }

    if (i < skills.length - 1) lines.push('');
  }

  // Summary
  const qualified = skills.filter((s) => s.isQualified).length;
  const enabled = skills.filter((s) => s.enabled).length;
  const problematic = skills.filter((s) => !s.isQualified).length;
  lines.push('');
  lines.push(`Summary: ${qualified} qualified, ${enabled} enabled, ${problematic} with errors`);

  return lines.join('\n');
}
