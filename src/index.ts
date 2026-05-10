import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { Type } from 'typebox';
import { executeSaveSkill, formatSaveSkillResult } from './save-skill.js';
import { executeMaterializeSkill, formatMaterializeSkillResult } from './skill-materialize.js';
import { executeListSkills, formatListSkillsResult } from './list-skills.js';
import { executeFixSkill, formatFixSkillResult } from './fix-skill.js';

export default function registerKnowledgeBaseSkills(pi: ExtensionAPI) {
  // ── kb_save_skill tool ──
  pi.registerTool({
    name: 'kb_save_skill',
    label: 'Save Skill',
    description: 'Save a skill into the knowledge base as linked skill-source and documentation articles',
    parameters: Type.Object({
      skillName: Type.String({
        description: 'Skill name in lowercase kebab-case (e.g. debug-with-screenshots)',
      }),
      skillContent: Type.String({
        description: 'Full SKILL.md content with embedded frontmatter containing "name" and "description" fields',
      }),
      docTitle: Type.Optional(Type.String({
        description: 'Optional human-friendly title for the documentation article',
      })),
      docContent: Type.Optional(Type.String({
        description: 'Optional markdown content for the documentation article',
      })),
      scope: Type.Optional(Type.Union([
        Type.Literal('local'),
        Type.Literal('global'),
      ], {
        description: 'Knowledge base scope (default: local)',
      })),
      tags: Type.Optional(Type.String({
        description: 'Optional additional tags as comma-separated key:value pairs',
      })),
      enabled: Type.Optional(Type.Boolean({
        description: 'Whether the skill is enabled (default: true)',
      })),
    }),
    async execute(_toolCallId, params) {
      const result = executeSaveSkill({
        skillName: params.skillName as string,
        skillContent: params.skillContent as string,
        docTitle: params.docTitle as string | undefined,
        docContent: params.docContent as string | undefined,
        scope: params.scope as 'local' | 'global' | undefined,
        tags: params.tags as string | undefined,
        enabled: params.enabled as boolean | undefined,
      });
      return {
        content: [{ type: 'text', text: formatSaveSkillResult(result) }],
        details: {},
      };
    },
  });

  // ── kb_install_skill tool — explicitly install a KB skill ──
  pi.registerTool({
    name: 'kb_install_skill',
    label: 'Install Skill',
    description: 'Install a skill from the knowledge base into a pi skill directory. Default: local project (.pi/agent/skills/). Use scope:global for user-wide (~/.pi/agent/skills/).',
    parameters: Type.Object({
      articleSlug: Type.String({
        description: 'Slug of the skill-source article in the knowledge base',
      }),
      scope: Type.Optional(Type.Union([
        Type.Literal('local'),
        Type.Literal('global'),
      ], {
        description: 'Install target (default: local — .pi/agent/skills/, global — ~/.pi/agent/skills/)',
      })),
    }),
    async execute(_toolCallId, params) {
      const result = executeMaterializeSkill({
        articleSlug: params.articleSlug as string,
        scope: params.scope as 'local' | 'global' | undefined,
      });
      return {
        content: [{ type: 'text', text: formatMaterializeSkillResult(result) }],
        details: {},
      };
    },
  });

  // ── kb_list_skills tool — list all skill-source articles ──
  pi.registerTool({
    name: 'kb_list_skills',
    label: 'List Skills',
    description: 'List all skill-source articles in the knowledge base with status and validation details',
    parameters: Type.Object({
      scope: Type.Optional(Type.Union([
        Type.Literal('local'),
        Type.Literal('global'),
        Type.Literal('all'),
      ], {
        description: 'Knowledge base scope to scan (default: all)',
      })),
      status: Type.Optional(Type.Union([
        Type.Literal('enabled'),
        Type.Literal('disabled'),
        Type.Literal('all'),
      ], {
        description: 'Filter by enabled/disabled status (default: all)',
      })),
      verbose: Type.Optional(Type.Boolean({
        description: 'Show detailed validation issues for each skill (default: false)',
      })),
    }),
    async execute(_toolCallId, params) {
      const result = executeListSkills({
        scope: params.scope as 'local' | 'global' | 'all' | undefined,
        status: params.status as 'enabled' | 'disabled' | 'all' | undefined,
        verbose: params.verbose as boolean | undefined,
      });
      return {
        content: [{ type: 'text', text: formatListSkillsResult(result, params.verbose as boolean | undefined) }],
        details: { skills: result.skills },
      };
    },
  });

  // ── kb_fix_skill tool — fix a broken skill-source article ──
  pi.registerTool({
    name: 'kb_fix_skill',
    label: 'Fix Skill',
    description: 'Validate and repair a skill-source article — add missing required tags, fix inner frontmatter, enable disabled skills',
    parameters: Type.Object({
      articleSlug: Type.String({
        description: 'Slug of the skill-source article to fix',
      }),
      fixTags: Type.Optional(Type.Boolean({
        description: 'Add missing required tags (type, kind, skill_ref, skill_name, audience, format, source). Default: true',
      })),
      fixFrontmatter: Type.Optional(Type.Boolean({
        description: 'Add or repair inner embedded frontmatter (name, description). Default: true',
      })),
      enable: Type.Optional(Type.Boolean({
        description: 'Change skill:disabled → skill:enabled',
      })),
      name: Type.Optional(Type.String({
        description: 'Override skill name (updates both tag:skill_name and inner frontmatter name)',
      })),
      description: Type.Optional(Type.String({
        description: 'Override description (updates inner frontmatter description)',
      })),
      source: Type.Optional(Type.String({
        description: 'Override source tag value (default: user)',
      })),
    }),
    async execute(_toolCallId, params) {
      const result = executeFixSkill({
        articleSlug: params.articleSlug as string,
        fixTags: params.fixTags as boolean | undefined,
        fixFrontmatter: params.fixFrontmatter as boolean | undefined,
        enable: params.enable as boolean | undefined,
        name: params.name as string | undefined,
        description: params.description as string | undefined,
        source: params.source as string | undefined,
      });
      return {
        content: [{ type: 'text', text: formatFixSkillResult(result) }],
        details: {},
      };
    },
  });
}
