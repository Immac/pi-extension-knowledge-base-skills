# knowledge-base-skills

A pi extension that discovers skill-source articles from the knowledge base and materializes them as cached `SKILL.md` runtime skill directories. It hooks into the `resources_discover` lifecycle event so generated skills are available to the pi runtime automatically.

![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?style=flat-square&logo=typescript)
![MIT License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![Pi Extension](https://img.shields.io/badge/pi--extension-orange?style=flat-square)

## Features

- 🔍 **Discovers skill-source articles** from the knowledge base by scanning for required tags (`type:skill`, `kind:skill-source`, `skill:enabled`)
- 📦 **Materializes cached skills** into `<cache>/<skill-name>/` directories containing `SKILL.md` and `SOURCE.json`
- 🔄 **Hooks into `resources_discover`** so skills are available to pi without manual refresh
- 🧩 **Validates skill structure** — requires embedded frontmatter with `name` and `description`, validates naming conventions
- 📍 **Configurable paths** via environment variables `KB_SKILLS_KB_PATH` and `KB_SKILLS_CACHE_PATH`

## How it works

```
resources_discover event
  → loader.refreshSkillCache()
    → kb.listArticleFiles(knowledgeBasePath)
    → kb.readArticle(slug, knowledgeBasePath)
    → skill-source.parseSkillSource(article)
    → cache.writeSkillCache(cacheRoot, skills)
  → returns { skillPaths } to pi runtime
```

## Qualification criteria

An article must include all of these tags to be recognized as a skill source:

| Tag | Value | Purpose |
|-----|-------|---------|
| `type` | `skill` | Marks the article as a skill definition |
| `kind` | `skill-source` | Distinguishes skill sources from other skill-related articles |
| `skill` | `enabled` | Opt-in flag; only enabled skills are materialized |
| `skill_ref` | `<id>` | Unique reference identifier for the skill |
| `skill_name` | `<name>` | Runtime name used for the cache directory and SKILL.md |

The article body must contain valid skill markdown with an embedded frontmatter block containing `name` (must match `skill_name`) and `description`.

## Output

Each discovered skill is materialized as:

```
<cache-root>/<skill-name>/
├── SKILL.md       ← Full skill markdown from the article body
└── SOURCE.json    ← Metadata linking back to the source article
```

## Quick Start

### Install

```bash
pi install ./knowledge-base-skills
```

### Configure

Default paths:
- Knowledge base: `~/.pi/knowledge-base/`
- Cache: `~/.cache/pi/kb-skills/`

Override with environment variables:

```bash
export KB_SKILLS_KB_PATH=/path/to/custom-knowledge-base
export KB_SKILLS_CACHE_PATH=/path/to/custom-cache
```

### Verify

The extension runs automatically on the `resources_discover` event. To check which skills were materialized:

```bash
ls ~/.cache/pi/kb-skills/
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
| `src/index.ts` | Registers `resources_discover` handler |
| `src/loader.ts` | Orchestrates discovery: scans KB, parses articles, writes cache |
| `src/kb.ts` | Reads articles from the knowledge base (supports folder-based and legacy layouts) |
| `src/skill-source.ts` | Validates article tags and parses embedded SKILL.md content |
| `src/cache.ts` | Writes `SKILL.md` and `SOURCE.json` to cache directories |
| `src/types.ts` | Type definitions |

## Resources

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — extension structure and interaction flows
- [`PLAN.md`](./PLAN.md) — implementation notes
- [`knowledge-base`](https://github.com/Immac/knowledge-base) — the knowledge base extension this depends on
