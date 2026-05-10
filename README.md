# knowledge-base-skills

A pi extension that manages pi skills stored as knowledge base articles — save, list, validate, fix, and install skills from the KB to your pi skill directories.

![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?style=flat-square&logo=typescript)
![MIT License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![Pi Extension](https://img.shields.io/badge/pi--extension-orange?style=flat-square)

## Features

- 💾 **`kb_save_skill` tool** — Save a new skill into the knowledge base as linked skill-source and documentation articles
- 📥 **`kb_install_skill` tool** — Install a KB skill into a project or global pi skill directory
- 📋 **`kb_list_skills` tool** — List all skill-source articles with status and validation details
- 🔧 **`kb_fix_skill` tool** — Validate and repair broken skill-source articles (missing tags, frontmatter, etc.)
- 🧩 **Validates skill structure** — supports both embedded inner frontmatter and outer article tag formats
- 📍 **Configurable KB path** via environment variable `KB_SKILLS_KB_PATH`

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
| `fixTags` | boolean | — | Add missing required tags. Off by default; enable explicitly |
| `fixFrontmatter` | boolean | — | Add or repair inner embedded frontmatter. Off by default; enable explicitly |
| `enable` | boolean | — | Change `skill:disabled` → `skill:enabled` |
| `name` | string? | — | Override skill name (updates tag and frontmatter) |
| `description` | string? | — | Override description (updates frontmatter) |
| `source` | string? | `"user"` | Override source tag value |

> **Note:** The extension does **not** auto-discover or auto-load skills from the KB.
> Skills are only installed when the user explicitly runs `kb_install_skill`.

## Qualification criteria

An article must include all of these tags to be recognized as a skill source:

| Tag | Value | Purpose |
|-----|-------|---------|
| `type` | `skill` | Marks the article as a skill definition |
| `kind` | `skill-source` | Distinguishes skill sources from other skill-related articles |
| `skill` | `enabled` or `disabled` | Opt-in flag; only `enabled` qualifies for installation |
| `skill_ref` | `<id>` | Unique reference identifier for the skill |
| `skill_name` | `<name>` | Runtime name used for the cache directory and SKILL.md |
| `audience` | `agent` | Marks as machine-oriented content |
| `format` | `agent-skill` | Content format marker |
| `source` | `user` | Origin tracking |

The skill metadata (`name`, `description`) can come from either:
- An **embedded inner frontmatter** block within the article body (preferred)
- The **outer article frontmatter** fields (fallback)

## Install targets

| Scope | Directory |
|-------|-----------|
| `local` (default) | `<cwd>/.pi/agent/skills/<name>/` |
| `global` | `~/.pi/agent/skills/<name>/` |

Each installation creates:

```
<target>/<skill-name>/
├── SKILL.md       ← Full skill markdown with proper frontmatter
└── SOURCE.json    ← Metadata linking back to the KB article
```

## Quick Start

### Install

```bash
pi install ./knowledge-base-skills
```

### Save a skill

```bash
kb_save_skill
  skillName: "my-analyzer"
  skillContent: "---\nname: my-analyzer\ndescription: Analyzes code\n---\n\nYou analyze code..."
  scope: local
```

### List and verify

```bash
kb_list_skills
  scope: local
  verbose: true
```

### Install to pi

```bash
kb_install_skill
  articleSlug: "my-analyzer-skill-source"
  scope: local
```

Then run `/reload` in pi to pick up the new skill.

### Fix broken skills

```bash
kb_fix_skill
  articleSlug: "my-analyzer-skill-source"
  fixTags: true
  fixFrontmatter: true
  enable: true
```

### Configure

Default paths:
- Knowledge base: `~/.pi/knowledge-base/`
- Install target: `.pi/agent/skills/` (project) or `~/.pi/agent/skills/` (global)

Override the knowledge base path:

```bash
export KB_SKILLS_KB_PATH=/path/to/custom-knowledge-base
```

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
| `src/index.ts` | Registers all 4 tools |
| `src/kb.ts` | Reads articles from and writes articles to the knowledge base |
| `src/skill-source.ts` | Validates article tags and parses skill metadata (inner and outer frontmatter) |
| `src/save-skill.ts` | `kb_save_skill` tool logic |
| `src/list-skills.ts` | `kb_list_skills` tool logic |
| `src/fix-skill.ts` | `kb_fix_skill` tool logic |
| `src/skill-materialize.ts` | `kb_install_skill` tool logic |
| `src/loader.ts` | Resolves the default knowledge base path |
| `src/types.ts` | Type definitions |

## Resources

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — extension structure and interaction flows
- [`PLAN.md`](./PLAN.md) — implementation notes
- [`tutorial/manual.pdf`](./tutorial/manual.pdf) — user manual
