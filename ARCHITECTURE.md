# Architecture

## Purpose

`knowledge-base-skills` is a pi extension that provides tools for managing pi skills stored as knowledge base articles. It lets users save skills to the KB, list them, validate them, fix broken ones, and explicitly install them into pi skill directories.

This extension does **not** auto-discover or auto-load skills from the KB. Skills are only installed when the user explicitly runs `kb_install_skill`.

## Goals

- Provide tool-first workflows for skill authoring and maintenance
- Validate skill structure (tags, naming, embedded frontmatter)
- Support both folder-based and legacy flat knowledge base layouts
- Require zero manual configuration beyond path overrides

## System Components

| Component | File(s) | Responsibility |
|---|---|---|
| Extension entrypoint | `knowledge-base-skills.ts`, `src/index.ts` | Registers the 4 tools (`kb_save_skill`, `kb_list_skills`, `kb_install_skill`, `kb_fix_skill`) |
| KB reader/writer | `src/kb.ts` | Reads articles from and writes articles to the knowledge base |
| Skill parser | `src/skill-source.ts` | Validates article tags and parses embedded SKILL.md frontmatter (inner or outer) |
| List skills | `src/list-skills.ts` | `kb_list_skills` tool — scans KB for skill-source articles and reports status |
| Save skill | `src/save-skill.ts` | `kb_save_skill` tool — creates linked skill-source + doc articles |
| Fix skill | `src/fix-skill.ts` | `kb_fix_skill` tool — repairs missing tags, frontmatter, enables disabled skills |
| Install skill | `src/skill-materialize.ts` | `kb_install_skill` tool — writes SKILL.md and SOURCE.json into a pi skill directory |
| Path resolver | `src/loader.ts` | Resolves the default knowledge base path |
| Types | `src/types.ts` | Shared type definitions |

## Tool Flow

```
User runs a tool (e.g. kb_install_skill)
         │
         ▼
  pi dispatches to tool handler
         │
         ├─► kb.readArticle(slug, knowledgeBasePath)
         │       └─► reads articles/{slug}/ARTICLE.md (or {slug}.md)
         │
         ├─► skill-source.parseSkillSource(article)
         │       ├─► checks required tags:
         │       │     type:skill, kind:skill-source
         │       ├─► validates skill_ref and skill_name tags
         │       ├─► parses embedded frontmatter (name, description)
         │       └─► validates name matches skill_name
         │
         └─► writes SKILL.md + SOURCE.json to target skill directory
```

## Key Principles

### 1. Explicit installation only

Skills are never auto-discovered or auto-loaded from the KB. The user must explicitly run `kb_install_skill` to install a skill into a pi skill directory.

### 2. Two-article model

Each skill has two linked KB articles:
- **Skill-source article** (`type:skill`, `kind:skill-source`, `skill:enabled`) — machine-oriented, contains raw SKILL.md
- **Documentation article** (`type:guide`, `kind:skill-doc`) — human-readable reference

Linked via a shared `skill_ref` tag.

### 3. Validation at parse time

Skills must have:
- Required tags (`type:skill`, `kind:skill-source`, `skill_ref`, `skill_name`, `audience:agent`, `format:agent-skill`, `source:user`)
- Correct `skill_name` format (lowercase, hyphen-separated, ≤64 chars)
- Matching `name` in embedded frontmatter
- Non-empty `description` and body content

### 4. Path configurability

Default KB path (`~/.pi/knowledge-base`) can be overridden via `KB_SKILLS_KB_PATH` environment variable.

### 5. KB layout agnostic

The `kb.ts` reader supports both the new folder-per-article layout (`articles/{slug}/ARTICLE.md`) and legacy flat files (`{slug}.md`).

### 6. Self-skill safeguard

The extension's own skill (`knowledge-base-skills`) is tagged `install:skip` in its KB article, preventing accidental re-installation from the KB since it's already bundled with the extension package.

## Dependencies

- **Runtime:** gray-matter (frontmatter parsing)
- **Peer:** @mariozechner/pi-coding-agent (ExtensionAPI), typebox
- **No external services** — all data is local filesystem
