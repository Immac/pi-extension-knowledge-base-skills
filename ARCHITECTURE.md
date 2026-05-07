# Architecture

## Purpose

`knowledge-base-skills` is a pi extension that bridges the knowledge base and pi's skill system. It discovers skill-source articles from the knowledge base, validates them, and materializes them as cached runtime skill directories that pi can load via the `resources_discover` lifecycle event.

## Goals

- Automatically surface skill definitions stored as knowledge base articles
- Keep the skill pipeline stateless and cache-backed
- Validate skill structure at discovery time (tags, naming, embedded frontmatter)
- Support both folder-based and legacy flat knowledge base layouts
- Require zero manual configuration beyond path overrides

## System Components

| Component | File(s) | Responsibility |
|---|---|---|
| Extension entrypoint | `knowledge-base-skills.ts`, `src/index.ts` | Registers the `resources_discover` event handler |
| Loader | `src/loader.ts` | Orchestrates the full pipeline: scan KB → read articles → parse skills → write cache |
| KB reader | `src/kb.ts` | Reads articles from the knowledge base filesystem (folder-based or legacy) |
| Skill parser | `src/skill-source.ts` | Validates article tags and parses embedded SKILL.md frontmatter |
| Cache writer | `src/cache.ts` | Materializes `SKILL.md` and `SOURCE.json` into cache directories |
| Types | `src/types.ts` | Shared type definitions |

## Data Flow

```
resources_discover event fired by pi runtime
         │
         ▼
  loader.refreshSkillCache(config)
         │
         ├─► kb.listArticleFiles(knowledgeBasePath)
         │       └─► reads articles/ subfolders (or legacy *.md files)
         │
         ├─► kb.readArticle(slug, knowledgeBasePath)
         │       └─► reads articles/{slug}/ARTICLE.md (or {slug}.md)
         │
         ├─► skill-source.parseSkillSource(article)
         │       ├─► checks required tags:
         │       │     type:skill, kind:skill-source, skill:enabled
         │       ├─► validates skill_ref and skill_name tags
         │       ├─► parses embedded frontmatter (name, description)
         │       └─► validates name matches skill_name
         │
         └─► cache.writeSkillCache(cacheRoot, skills)
                 ├─► clears existing cache
                 ├─► creates <skill-name>/ directories
                 ├─► writes SKILL.md (full article body)
                 └─► writes SOURCE.json (metadata)
         │
         ▼
  returns { skillPaths } to pi runtime
```

## Key Principles

### 1. Stateless discovery

Everything is derived from the knowledge base at `resources_discover` time. The cache is wiped and rebuilt on each cycle — there is no incremental state.

### 2. Explicit opt-in

Only articles with all three tags (`type:skill`, `kind:skill-source`, `skill:enabled`) qualify. This prevents accidental skill registration from regular documentation articles.

### 3. Validation at parse time

Skills must have:
- Correct `skill_name` format (lowercase, hyphen-separated, ≤64 chars)
- Matching `name` in embedded frontmatter
- Non-empty `description` and body content

Invalid articles are silently skipped.

### 4. Path configurability

Default paths (`~/.pi/knowledge-base` and `~/.cache/pi/kb-skills`) can be overridden via environment variables, making the extension usable with non-standard knowledge base locations.

### 5. KB layout agnostic

The `kb.ts` reader supports both the new folder-per-article layout (`articles/{slug}/ARTICLE.md`) and legacy flat files (`{slug}.md`), so the extension works regardless of which KB format is in use.

## Dependencies

- **Runtime:** gray-matter (frontmatter parsing)
- **Peer:** @mariozechner/pi-coding-agent (ExtensionAPI), typebox
- **No external services** — all data is local filesystem
