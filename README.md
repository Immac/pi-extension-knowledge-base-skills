# knowledge-base-skills

A pi extension that discovers skill-source articles from the knowledge base and materializes them as pi skills. It hooks into the `resources_discover` lifecycle event so generated skills are available to the pi runtime automatically, and provides tools for saving new skills into the knowledge base.

![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?style=flat-square&logo=typescript)
![MIT License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![Pi Extension](https://img.shields.io/badge/pi--extension-orange?style=flat-square)

## Features

- 🔍 **Discovers skill-source articles** from the knowledge base by scanning for required tags (`type:skill`, `kind:skill-source`, `skill:enabled`)
- 📦 **Materializes skills as `SKILL.md`** into project-local `.pi/skills/` by default (falls back to `~/.pi/agent/skills/`)
- 💾 **`kb_save_skill` tool** — Save a new skill into the knowledge base as linked skill-source and documentation articles
- 📥 **`kb_install_skill` tool** — Install a KB skill into a project or global pi skill directory
- 📋 **`kb_list_skills` tool** — List all skill-source articles with status and validation details
- 🔧 **`kb_fix_skill` tool** — Validate and repair broken skill-source articles (missing tags, frontmatter, etc.)
- 🔄 **Hooks into `resources_discover`** so skills are available to pi without manual refresh
- 🧩 **Validates skill structure** — supports both embedded inner frontmatter and outer article tag formats
- 📍 **Configurable paths** via environment variables `KB_SKILLS_KB_PATH` and `KB_SKILLS_CACHE_PATH`

## How it works

```
resources_discover event
  → loader.refreshSkillCache()
    → kb.listArticleFiles(knowledgeBasePath)
    → kb.readArticle(slug, knowledgeBasePath)
    → skill-source.parseSkillSource(article)  ← handles inner and outer frontmatter
    → cache.writeSkillCache(cacheRoot, skills)
  → returns { skillPaths } to pi runtime
```

## Tools

### `kb_save_skill`

Save a skill into the knowledge base. Creates two linked articles:
- A **skill-source article** (`type:skill`, `kind:skill-source`, `skill:enabled`) — machine-oriented, used by the loader
- A **documentation article** (`type:guide`, `kind:skill-doc`) — human-readable reference

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `skillName` | string | — | Skill name in lowercase kebab-case (e.g. `debug-with-screenshots`) |
| `skillContent` | string | — | Full `SKILL.md` with embedded frontmatter containing `name` and `description` |
| `docTitle` | string? | — | Human-friendly title for the documentation article |
| `docContent` | string? | — | Markdown content for the documentation article |
| `scope` | `"local"` \| `"global"` | `"local"` | Knowledge base scope |
| `tags` | string? | — | Additional tags as comma-separated `key:value` pairs |
| `enabled` | boolean | `true` | Whether the skill is enabled for loading |

### `kb_list_skills`

List all skill-source articles in the knowledge base with status and validation details.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `scope` | `"local"` \| `"global"` \| `"all"` | `"all"` | Knowledge base scope to scan |
| `status` | `"enabled"` \| `"disabled"` \| `"all"` | `"all"` | Filter by enabled/disabled status |
| `verbose` | boolean | `false` | Show detailed validation issues per skill |

### `kb_install_skill`

Install a skill from the knowledge base into a pi skill directory.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `articleSlug` | string | — | Slug of the skill-source article in the knowledge base |
| `scope` | `"local"` \| `"global"` | `"local"` | Install target (project `.pi/agent/skills/` or `~/.pi/agent/skills/`) |

### `kb_fix_skill`

Validate and repair a skill-source article — add missing required tags, fix inner frontmatter, enable disabled skills.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `articleSlug` | string | — | Slug of the skill-source article to fix |
| `fixTags` | boolean | `true` | Add missing required tags |
| `fixFrontmatter` | boolean | `true` | Add or repair inner embedded frontmatter |
| `enable` | boolean | — | Change `skill:disabled` → `skill:enabled` |
| `name` | string? | — | Override skill name (updates tag and frontmatter) |
| `description` | string? | — | Override description (updates frontmatter) |
| `source` | string? | `"user"` | Override source tag value |

### Auto-discovery (`resources_discover`)

On session start, the extension automatically scans all KB articles for skill-source articles matching the qualification criteria and materializes them into the default cache directory.

## Qualification criteria

An article must include all of these tags to be recognized as a skill source:

| Tag | Value | Purpose |
|-----|-------|---------|
| `type` | `skill` | Marks the article as a skill definition |
| `kind` | `skill-source` | Distinguishes skill sources from other skill-related articles |
| `skill` | `enabled` | Opt-in flag; only enabled skills are materialized |
| `skill_ref` | `<id>` | Unique reference identifier for the skill |
| `skill_name` | `<name>` | Runtime name used for the cache directory and SKILL.md |

The skill metadata (`name`, `description`) can come from either:
- An **embedded inner frontmatter** block within the article body (preferred for save-tool output)
- The **outer article frontmatter tags** or title (for compatibility with existing KB articles)

## Output

Each discovered skill is materialized as:

```
<default-dir>/<skill-name>/
├── SKILL.md       ← Full skill markdown from the article body
└── SOURCE.json    ← Metadata linking back to the source article
```

The default directory is:
1. Project-local `.pi/skills/` in CWD (created if needed)
2. `~/.pi/agent/skills/` (global user skills directory)

## Quick Start

### Install

```bash
pi install ./knowledge-base-skills
```

### Configure

Default paths:
- Knowledge base: `~/.pi/knowledge-base/`
- Cache: project `.pi/skills/` (created if needed), else `~/.pi/agent/skills/`

Override with environment variables:

```bash
export KB_SKILLS_KB_PATH=/path/to/custom-knowledge-base
export KB_SKILLS_CACHE_PATH=/path/to/custom-cache
```

### Verify

The extension runs automatically on the `resources_discover` event. To check which skills were materialized:

```bash
ls .pi/skills/
# or for global:
ls ~/.pi/agent/skills/
```

Each directory contains `SKILL.md` and `SOURCE.json`.

## Development

### Prerequisites

- Node.js 18+
- npm
- pi coding-agent runtime

### Setup

```bash
npm install
```

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

### Key files

| File | Purpose |
|---|---|
| `knowledge-base-skills.ts` | Extension entrypoint for pi |
| `src/index.ts` | Registers `resources_discover` handler and `kb_save_skill` / `kb_materialize_skill` tools |
| `src/loader.ts` | Orchestrates discovery: scans KB, parses articles, writes cache (defaults to project-local) |
| `src/kb.ts` | Reads articles from and writes articles to the knowledge base |
| `src/skill-source.ts` | Validates article tags and parses skill metadata (inner and outer frontmatter) |
| `src/cache.ts` | Writes `SKILL.md` and `SOURCE.json` to cache directories |
| `src/save-skill.ts` | `kb_save_skill` tool logic |
| `src/skill-materialize.ts` | `kb_materialize_skill` tool logic |
| `src/types.ts` | Type definitions |

## Resources

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — extension structure and interaction flows
- [`PLAN.md`](./PLAN.md) — implementation notes
- [`knowledge-base`](https://github.com/Immac/knowledge-base) — the knowledge base extension this depends on
