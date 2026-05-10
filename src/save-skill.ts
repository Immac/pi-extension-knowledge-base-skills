import matter from 'gray-matter';
import { createArticle, resolveKbPath } from './kb.js';
import type { SaveSkillOptions, SaveSkillResult, ValueTag } from './types.js';

function isSkillNameValid(name: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) && name.length <= 64;
}

function parseTagsString(tagsStr?: string): readonly ValueTag[] {
  if (!tagsStr) return [];
  return tagsStr
    .split(',')
    .map((tag) => {
      const idx = tag.indexOf(':');
      if (idx === -1) return null;
      return { key: tag.slice(0, idx).trim(), value: tag.slice(idx + 1).trim() };
    })
    .filter((tag): tag is ValueTag => tag !== null && tag.key.length > 0 && tag.value.length > 0);
}

export function executeSaveSkill(options: SaveSkillOptions): SaveSkillResult {
  try {
    const { skillName, skillContent, docTitle, docContent, scope, tags, enabled } = options;
    const targetScope = scope ?? 'local';

    // Validate skill name
    if (!isSkillNameValid(skillName)) {
      return { success: false, error: `Invalid skill name "${skillName}". Use lowercase kebab-case (e.g. my-skill).` };
    }

    if (!skillContent.trim()) {
      return { success: false, error: 'skillContent is required' };
    }

    // Parse embedded frontmatter from the skill content
    const parsed = matter(skillContent);
    const frontmatter = parsed.data as { name?: unknown; description?: unknown };
    const embeddedName = typeof frontmatter.name === 'string' ? frontmatter.name : '';
    const embeddedDescription = typeof frontmatter.description === 'string' ? frontmatter.description : '';

    if (!isSkillNameValid(embeddedName)) {
      return { success: false, error: `Skill content frontmatter must have a valid lowercase kebab-case "name" field. Got: "${embeddedName}"` };
    }

    if (embeddedName !== skillName) {
      return { success: false, error: `Skill name mismatch: "${embeddedName}" in content frontmatter vs "${skillName}" in parameter` };
    }

    if (!embeddedDescription.trim()) {
      return { success: false, error: 'Skill content frontmatter must have a non-empty "description" field' };
    }

    const skillRef = skillName;
    const now = new Date();
    const extraTags = parseTagsString(tags);

    // Build common tags
    const sourceTag: ValueTag = { key: 'source', value: 'user' };
    const projectTag: ValueTag = { key: 'project', value: 'knowledge-base-skills' };

    // ── Skill-source article ──
    const skillTags: readonly ValueTag[] = [
      projectTag,
      { key: 'type', value: 'skill' },
      { key: 'kind', value: 'skill-source' },
      { key: 'skill', value: enabled !== false ? 'enabled' : 'disabled' },
      { key: 'skill_ref', value: skillRef },
      { key: 'skill_name', value: skillName },
      { key: 'audience', value: 'agent' },
      { key: 'format', value: 'agent-skill' },
      sourceTag,
      ...extraTags,
    ];

    const skillArticleTitle = `${skillName} skill source`;
    const kbPath = resolveKbPath(targetScope);
    const skillArticle = createArticle({
      title: skillArticleTitle,
      tags: skillTags,
      content: skillContent,
      created: now,
      modified: now,
    }, kbPath);

    // ── Documentation article ──
    const docTags: readonly ValueTag[] = [
      projectTag,
      { key: 'type', value: 'guide' },
      { key: 'kind', value: 'skill-doc' },
      { key: 'skill_ref', value: skillRef },
      { key: 'skill_name', value: skillName },
      { key: 'audience', value: 'human' },
      sourceTag,
      ...extraTags,
    ];

    const effectiveDocTitle = docTitle ?? `${skillName} skill`;
    const defaultDocContent = docContent
      ? docContent
      : [
          `# ${skillName} skill`,
          '',
          embeddedDescription,
          '',
          '## Usage',
          '',
          'This skill is loaded automatically by the knowledge-base-skills extension.',
          '',
          '## Source',
          '',
          `Skill source article: \`${skillArticle.slug}\``,
        ].join('\n');

    const docArticle = createArticle({
      title: effectiveDocTitle,
      tags: docTags,
      content: defaultDocContent,
      created: now,
      modified: now,
    }, kbPath);

    return {
      success: true,
      skillSlug: skillArticle.slug,
      docSlug: docArticle.slug,
      skillRef,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export function formatSaveSkillResult(result: SaveSkillResult): string {
  if (!result.success) {
    return `Error saving skill: ${result.error}`;
  }

  const parts = [
    `Saved skill: ${result.skillRef}`,
    `  Skill-source article: ${result.skillSlug}`,
    `  Documentation article: ${result.docSlug}`,
  ];

  return parts.join('\n');
}
