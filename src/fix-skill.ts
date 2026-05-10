import { readFileSync, writeFileSync } from 'fs';
import matter from 'gray-matter';
import { readArticle } from './kb.js';
import type { ValueTag } from './types.js';
import { getDefaultKnowledgeBasePath } from './loader.js';

export interface FixSkillOptions {
  readonly articleSlug: string;
  /** Add missing required tags */
  readonly fixTags?: boolean;
  /** Add missing inner frontmatter (name, description) */
  readonly fixFrontmatter?: boolean;
  /** Enable the skill (change skill:disabled → skill:enabled) */
  readonly enable?: boolean;
  /** Override skill name (for fixing mismatches) */
  readonly name?: string;
  /** Override description */
  readonly description?: string;
  /** Source tag value (default: 'user') */
  readonly source?: string;
}

export interface FixSkillAction {
  readonly type: 'tag_added' | 'tag_fixed' | 'tag_enabled' | 'frontmatter_added' | 'frontmatter_fixed' | 'content_updated' | 'no_change';
  readonly field: string;
  readonly detail: string;
}

export interface FixSkillResult {
  readonly success: boolean;
  readonly slug: string;
  readonly actions: readonly FixSkillAction[];
  readonly filePath?: string;
  readonly error?: string;
}

const REQUIRED_TAG_DEFAULTS: Record<string, string> = {
  type: 'skill',
  kind: 'skill-source',
  audience: 'agent',
  format: 'agent-skill',
};

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
        if (key === 'name') name = val;
        if (key === 'description') description = val;
      }
    }
  }
  return { name, description };
}

export function executeFixSkill(options: FixSkillOptions): FixSkillResult {
  try {
    const { articleSlug, fixTags, fixFrontmatter, enable, name, description, source } = options;
    const knowledgeBasePath = getDefaultKnowledgeBasePath();
    const article = readArticle(articleSlug, knowledgeBasePath);

    if (!article) {
      return { success: false, slug: articleSlug, actions: [], error: `Article not found: ${articleSlug}` };
    }

    const actions: FixSkillAction[] = [];
    const raw = readFileSync(article.filePath, 'utf8');
    const parsed = matter(raw);
    const tagList: string[] = Array.isArray(parsed.data.tags)
      ? parsed.data.tags.map((t: unknown) => String(t))
      : [];

    const existingTags = new Map<string, string>();
    for (const tagStr of tagList) {
      const colonIdx = tagStr.indexOf(':');
      if (colonIdx === -1) continue;
      const key = tagStr.slice(0, colonIdx).trim();
      const val = tagStr.slice(colonIdx + 1).trim().replace(/^'|'$/g, '');
      if (!existingTags.has(key)) {
        existingTags.set(key, val);
      }
    }

    // ── Tag fixes ──
    if (fixTags) {
      // Add missing required tags
      const tagKeysToEnsure = ['type', 'kind', 'skill_ref', 'skill_name', 'audience', 'format', 'source'];
      for (const key of tagKeysToEnsure) {
        if (!existingTags.has(key)) {
          let val = '';
          if (key === 'skill_ref') val = articleSlug;
          else if (key === 'skill_name') val = name || articleSlug;
          else if (key === 'source') val = source || 'user';
          else val = REQUIRED_TAG_DEFAULTS[key] || '';

          if (val) {
            existingTags.set(key, val);
            actions.push({ type: 'tag_added', field: `tag:${key}`, detail: `Added tag "${key}:${val}"` });
          }
        }
      }
    }

    // Fix skill_name if misnamed
    const currentSkillName = existingTags.get('skill_name');
    if (name && currentSkillName !== name) {
      if (isSkillNameValid(name)) {
        existingTags.set('skill_name', name);
        actions.push({ type: 'tag_fixed', field: 'tag:skill_name', detail: `Changed skill_name from "${currentSkillName || '(none)'}" to "${name}"` });
      }
    }

    // Enable skill
    if (enable) {
      const skillVal = existingTags.get('skill');
      if (skillVal === 'disabled') {
        existingTags.set('skill', 'enabled');
        actions.push({ type: 'tag_enabled', field: 'tag:skill', detail: 'Changed skill:disabled → skill:enabled' });
      } else if (!skillVal) {
        existingTags.set('skill', 'enabled');
        actions.push({ type: 'tag_enabled', field: 'tag:skill', detail: 'Added skill:enabled tag' });
      }
    } else if (fixTags && !existingTags.has('skill')) {
      existingTags.set('skill', 'disabled');
      actions.push({ type: 'tag_added', field: 'tag:skill', detail: 'Added skill:disabled tag (use enable option to change)' });
    }

    // ── Inner frontmatter fixes ──
    if (fixFrontmatter) {
      const body = parsed.content;

      // Parse existing inner frontmatter first to use as defaults
      const existingInner = parseInnerFrontmatter(body);
      const effectiveName = name || existingInner.name || existingTags.get('skill_name') || articleSlug;
      const effectiveDescription = description ?? existingInner.description ?? '';

      const trimmedBody = body.trimStart();
      let newContent = body;

      if (trimmedBody.startsWith('---')) {
        const endIndex = trimmedBody.indexOf('---', 3);
        if (endIndex !== -1) {
          // Parse existing inner frontmatter
          const innerRaw = trimmedBody.slice(3, endIndex).trim();
          const innerLines = innerRaw.split('\n');
          const contentAfter = trimmedBody.slice(endIndex + 3).trimStart();

          const newInnerLines: string[] = [];
          let hadName = false;
          let hadDescription = false;
          let nameMatch = false;
          let descMatch = false;

          for (const line of innerLines) {
            const colonIdx = line.indexOf(':');
            if (colonIdx === -1) {
              newInnerLines.push(line);
              continue;
            }
            const key = line.slice(0, colonIdx).trim();
            const val = line.slice(colonIdx + 1).trim().replace(/^['"]|['"]$/g, '');
            if (key === 'name') {
              newInnerLines.push(`name: ${effectiveName}`);
              hadName = true;
              if (val === effectiveName) nameMatch = true;
            } else if (key === 'description') {
              newInnerLines.push(`description: ${effectiveDescription || ''}`);
              hadDescription = true;
              if (val === effectiveDescription) descMatch = true;
            } else {
              newInnerLines.push(line);
            }
          }

          if (!hadName) {
            newInnerLines.unshift(`name: ${effectiveName}`);
          }
          if (!hadDescription) {
            newInnerLines.push(`description: ${effectiveDescription || ''}`);
          }

          // Only reconstruct if something actually changed
          if (hadName && hadDescription && nameMatch && descMatch) {
            // Inner frontmatter is already correct — no change
            newContent = body;
          } else {
            newContent = `---\n${newInnerLines.join('\n')}\n---\n\n${contentAfter}`;
            if (!hadName || !hadDescription) {
              actions.push({
                type: 'frontmatter_added',
                field: 'inner-frontmatter',
                detail: `Added missing ${!hadName ? 'name' : ''}${!hadName && !hadDescription ? ' and ' : ''}${!hadDescription ? 'description' : ''} to inner frontmatter`,
              });
            } else {
              actions.push({
                type: 'frontmatter_fixed',
                field: 'inner-frontmatter',
                detail: `Updated ${!nameMatch ? 'name' : ''}${!nameMatch && !descMatch ? ' and ' : ''}${!descMatch ? 'description' : ''} in inner frontmatter`,
              });
            }
          }
        } else {
          // Inner frontmatter start but no closing ---, replace whole block
          newContent = `---\nname: ${effectiveName}\ndescription: ${effectiveDescription}\n---\n\n${trimmedBody.slice(3).trimStart()}`;
          actions.push({ type: 'frontmatter_added', field: 'inner-frontmatter', detail: 'Replaced malformed inner frontmatter (missing closing ---)' });
        }
      } else {
        // No inner frontmatter — add one
        newContent = `---\nname: ${effectiveName}\ndescription: ${effectiveDescription}\n---\n\n${body.trimStart()}`;
        actions.push({ type: 'frontmatter_added', field: 'inner-frontmatter', detail: 'Added inner frontmatter block with name and description' });
      }

      // Update parsed content
      parsed.content = newContent;
    }

    // ── Write changes ──
    if (actions.length === 0) {
      return { success: true, slug: articleSlug, actions, filePath: article.filePath };
    }

    // Rebuild tags list preserving original order
    const newTagStrings: string[] = [];
    const seenKeys = new Set<string>();
    for (const tagStr of tagList) {
      const colonIdx = tagStr.indexOf(':');
      if (colonIdx === -1) continue;
      const key = tagStr.slice(0, colonIdx).trim();
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      if (existingTags.has(key)) {
        newTagStrings.push(`'${key}:${existingTags.get(key)}'`);
      } else {
        newTagStrings.push(tagStr);
      }
    }
    // Add any newly introduced keys at the end
    for (const [key, val] of existingTags) {
      if (!seenKeys.has(key)) {
        newTagStrings.push(`'${key}:${val}'`);
        seenKeys.add(key);
      }
    }

    // Manually serialize frontmatter (gray-matter.stringify destroys inner frontmatter)
    const now = new Date().toISOString();
    const origTitle = parsed.data.title || articleSlug;
    const origCreated = parsed.data.created || now;

    const frontmatterLines: string[] = [
      '---',
      `title: ${origTitle}`,
      'tags:',
    ];
    for (const tagStr of newTagStrings) {
      frontmatterLines.push(`  - ${tagStr}`);
    }
    frontmatterLines.push(`created: ${origCreated}`);
    frontmatterLines.push(`modified: ${now}`);
    frontmatterLines.push('---');

    const body = (parsed.content || '').trimEnd();
    if (body) {
      frontmatterLines.push('');
      frontmatterLines.push(body);
    }
    frontmatterLines.push('');

    writeFileSync(article.filePath, frontmatterLines.join('\n'), 'utf8');

    return {
      success: true,
      slug: articleSlug,
      actions,
      filePath: article.filePath,
    };
  } catch (error) {
    return {
      success: false,
      slug: options.articleSlug,
      actions: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export function formatFixSkillResult(result: FixSkillResult): string {
  if (!result.success) {
    return `Error fixing skill: ${result.error}`;
  }

  const lines = [`Fixed skill article: ${result.slug}`];

  if (result.filePath) {
    lines.push(`  File: ${result.filePath}`);
  }

  if (result.actions.length === 0) {
    lines.push('  No changes needed — skill is already valid.');
  } else {
    lines.push(`  Actions (${result.actions.length}):`);
    for (const action of result.actions) {
      lines.push(`    • ${action.type}: ${action.detail}`);
    }
  }

  return lines.join('\n');
}
