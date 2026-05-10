# Knowledge Base Skills — Plan

## Goal

Create a pi extension that:

1. saves skills into the knowledge base as articles
2. keeps a human-readable documentation article separate from the pure skill-source article
3. dynamically loads enabled skill-source articles from the knowledge base as pi skills
4. defaults to local project install when materializing

## Why a separate extension

This should live outside `knowledge-base-reader` because it is not a UI concern. It is a general pi extension that bridges:

- the knowledge base
- pi skill discovery
- skill authoring and persistence

Planned workspace:

- `/home/immac/Repositories/ai_generation/tools/pi-extensions/knowledge-base-skills/`

## Scope

### In scope

- a pi extension that contributes generated skill paths via `resources_discover`
- a tool-first workflow for saving a skill into the knowledge base
- a two-article model:
  - readable skill documentation article
  - pure skill-source article
- deterministic generation of loadable pi skills from KB articles
- tag schema that creates useful natural connections in the knowledge base
- local project install as default materialization target

### Out of scope for first version

- rich TUI editors
- version history beyond normal KB article metadata
- skill dependency management
- automatic migration of existing standalone skills into KB format
- bidirectional sync from generated runtime skill back into source article text after manual edits in cache

## Core concept

Each skill is represented by **two knowledge-base articles** sharing a common identity.

### Article A: readable documentation article

Purpose:

- explain what the skill does
- describe when to use it
- include examples, caveats, references, and maintenance notes
- serve human browsing and search

### Article B: pure skill-source article

Purpose:

- hold the canonical machine-oriented skill markdown
- be transformed into a generated `SKILL.md` at runtime
- be the only article type that the loader extension converts into a pi skill

## Shared identity model

Use a stable shared identifier across both articles:

- `skill_ref:<id>`

Example:

- `skill_ref:debug-with-screenshots`

This allows:

- one doc article to point to one skill-source article
- future support for alternates or variants
- easy grouping in KB queries

## Tag schema

The goal is not just filtering. Tags should create meaningful graph-like relationships across projects, domains, tools, and audiences.

### Required tags for readable doc article

- `project:knowledge-base-skills`
- `type:guide`
- `kind:skill-doc`
- `skill_ref:<shared-id>`
- `skill_name:<runtime-skill-name>`
- `audience:human`
- `source:user`

### Required tags for pure skill-source article

- `project:knowledge-base-skills`
- `type:skill`
- `kind:skill-source`
- `skill:enabled`
- `skill_ref:<shared-id>`
- `skill_name:<runtime-skill-name>`
- `audience:agent`
- `format:agent-skill`
- `source:user`

### Recommended optional tags

These are encouraged whenever they truthfully add discovery value.

#### Lifecycle / maintenance

- `status:draft`
- `status:stable`
- `status:deprecated`
- `owner:<person-or-team>`
- `loader:knowledge-base-skills`

#### Domain and topic

- `domain:debugging`
- `domain:web`
- `domain:knowledge-base`
- `topic:screenshots`
- `topic:playwright`
- `topic:tagging`

#### Operational relevance

- `tool:playwright`
- `tool:read`
- `tool:bash`
- `tool:web-search`
- `tool:open-url`

#### Use-case and audience

- `audience:human`
- `audience:agent`
- `level:beginner`
- `level:intermediate`
- `level:advanced`

#### Format / relationship tags

- `format:markdown`
- `format:agent-skill`
- `rel:documentation`
- `rel:runtime-source`

## Article shapes

### Readable documentation article

Expected frontmatter:

- `title`
- `tags`
- `created`
- `modified`

Expected content sections:

- summary
- purpose
- when to use
- examples
- related tools / related skills
- pointer to the skill source article via shared `skill_ref`

### Pure skill-source article

Expected frontmatter:

- `title`
- `tags`
- `created`
- `modified`

Expected body:

- valid skill markdown suitable for conversion into `SKILL.md`
- must include skill frontmatter with a valid `name` and `description` (inner frontmatter block, or outer article tags)

## Extension architecture

### Main responsibilities

1. discover KB articles from the configured knowledge base path
2. identify skill-source articles by tag
3. validate and extract the skill markdown payload
4. generate cache-backed runtime skill directories
5. expose generated skill paths through `resources_discover`
6. provide a tool to save a skill into the KB as linked articles
7. provide a tool to materialize a KB skill into a local directory
8. default to local project `.pi/skills/` for materialization

### Runtime pieces

#### 1. knowledge base scanner

- locates KB source directory
- reads articles
- parses frontmatter and markdown
- filters for candidate skill-source articles

#### 2. skill-source validator

- ensures required tags exist
- validates `skill_ref`
- validates skill name format
- validates skill markdown frontmatter and description
- records warnings for malformed but potentially recoverable inputs

#### 3. generated skill cache

- writes generated runtime skills into a cache directory
- uses deterministic directory names based on `skill_name`
- regenerates on startup/reload
- may optionally include a manifest for traceability

Default location:

- project-local `.pi/skills/` if a `.pi/` directory exists in the project tree
- `~/.pi/agent/skills/` otherwise

#### 4. pi extension entrypoint

- hooks `resources_discover`
- returns generated skill paths
- registers tools for skill saving and materialization

#### 5. save-skill tool

- `kb_save_skill`
- accepts skill name, content, optional doc content, scope, tags
- writes skill doc article and skill source article
- ensures they share `skill_ref`
- defaults to local KB scope

#### 6. materialize-skill tool

- `kb_materialize_skill`
- accepts article slug, optional target directory
- reads and validates the KB article
- writes `SKILL.md` and `SOURCE.json` to target directory

## Tool-first interface

### Registered tools

- `kb_save_skill` (implemented)
- `kb_materialize_skill` (implemented)

### Future candidates

- `kb_list_skills`
- `kb_export_skill`
- `kb_enable_skill`
- `kb_disable_skill`
- `kb_validate_skills`

## Generated runtime skill model

Each enabled skill-source article becomes:

```
<default-materialize-dir>/<skill-name>/
├── SKILL.md       ← Full skill markdown from the article body
└── SOURCE.json    ← Metadata linking back to the source article
```

## Validation rules

### Hard requirements

- `type:skill`
- `kind:skill-source`
- `skill:enabled`
- `skill_ref:*`
- `skill_name:*`
- valid skill name (inner frontmatter or outer tags)
- non-empty skill description
- skill `name` must match `skill_name`

### Soft requirements / warnings

- missing linked doc article
- missing `status:*`
- weak or overly vague description
- missing `project:knowledge-base-skills`

## Development phases

### Phase 1 — design and planning ✓

- finalize tag schema
- finalize article layout
- choose cache location
- define validation policy

### Phase 2 — extension skeleton ✓

- create package structure
- add TypeScript config
- create named entrypoint
- implement `resources_discover`

### Phase 3 — loader pipeline ✓

- read KB articles
- detect skill-source articles
- validate and extract skill content
- generate cache-backed skills
- return generated skill paths

### Phase 4 — save-skill tool ✓

- register tool
- create linked doc and source articles
- normalize tags and IDs
- support both inner and outer frontmatter formats

### Phase 5 — materialize-skill tool ✓

- register tool
- read and validate KB articles
- write SKILL.md and SOURCE.json

### Phase 6 — local project default ✓

- detect `.pi/` directory in project tree
- default to `.pi/skills/` for materialization
- fallback to global cache

### Phase 7 — documentation and tests ✓

- README with tools documentation
- article-format documentation
- tests for discovery and tools

### Phase 8 — install and iterate

- install as a pi extension
- verify `/reload` picks up KB-backed skills
- refine tags and authoring ergonomics

## Open questions

1. ~~Should the skill-source article body be only raw skill markdown, or should it allow wrapper sections around the skill payload?~~ Resolved: raw skill markdown with optional inner frontmatter
2. ~~Should the save tool accept doc content directly, or create a minimal doc article and let humans expand it later?~~ Resolved: accepts optional doc content, auto-generates when absent
3. ~~What cache location is best for portability and cleanup?~~ Resolved: project-local `.pi/skills/` with fallback to `~/.pi/agent/skills/`
4. Should disabled skills remain generated but hidden, or be omitted entirely from generated skill paths?
5. Should the extension support one doc article for multiple skill variants in later versions?
6. Should the loader tolerate malformed articles with warnings, or skip aggressively in strict mode?
7. Should references/assets be supported in v1, or deferred until the article format stabilizes?

## Recommended next step

Install the extension into pi and verify that `kb_save_skill` and `kb_materialize_skill` work in a live session, and that `resources_discover` picks up KB-backed skills on reload.
