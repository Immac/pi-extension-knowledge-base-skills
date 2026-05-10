# Knowledge Base Skills — Plan

## Goal

Create a pi extension that:

1. saves skills into the knowledge base as articles
2. keeps a human-readable documentation article separate from the pure skill-source article
3. provides tools to list, validate, fix, and explicitly install skills from the KB
4. defaults to local project install when materializing

**Note:** Auto-discovery of skills from the KB was removed. Skills are only installed when the user explicitly runs `kb_install_skill`.

## Why a separate extension

This should live outside `knowledge-base-reader` because it is not a UI concern. It is a general pi extension that bridges:

- the knowledge base
- pi skill discovery
- skill authoring and persistence

Planned workspace:

- `/home/immac/Repositories/ai_generation/tools/pi-extensions/knowledge-base-skills/`

## Scope

### In scope

- a tool-first workflow for saving, listing, validating, fixing, and installing skills
- a two-article model:
  - readable skill documentation article
  - pure skill-source article
- deterministic generation of loadable pi skills from KB articles
- tag schema that creates useful natural connections in the knowledge base
- local project install as default materialization target
- `install:skip` tag to prevent specific skills from being installed (used for the extension's own bundled skill)

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

1. provide a tool to save a skill into the KB as linked articles (`kb_save_skill`)
2. provide a tool to list skill-source articles in the KB (`kb_list_skills`)
3. provide a tool to install a KB skill into a pi skill directory (`kb_install_skill`)
4. provide a tool to validate and repair broken skill-source articles (`kb_fix_skill`)
5. default to local project `.pi/agent/skills/` for installation

### Runtime pieces

#### 1. save-skill tool (`kb_save_skill`)

- accepts skill name, content, optional doc content, scope, tags
- writes skill doc article and skill source article
- ensures they share `skill_ref`
- defaults to local KB scope

#### 2. list-skills tool (`kb_list_skills`)

- scans KB for candidate articles (tags: `type:skill`, `kind:skill-source`)
- validates tag completeness and frontmatter
- reports enabled/disabled status and qualification issues

#### 3. install-skill tool (`kb_install_skill`)

- accepts article slug, optional scope
- reads and validates the KB article
- writes `SKILL.md` and `SOURCE.json` to target directory
- respects `install:skip` tag (must pass `allowSkip: true`)

#### 4. fix-skill tool (`kb_fix_skill`)

- accepts article slug
- adds missing required tags
- repairs or adds inner frontmatter (name, description)
- enables disabled skills
- fixes name mismatches

#### 5. skill-source validator (`src/skill-source.ts`)

- ensures required tags exist
- validates `skill_ref`
- validates skill name format
- validates skill markdown frontmatter and description
- records warnings for malformed but potentially recoverable inputs

## Tool-first interface

### Registered tools

- `kb_save_skill` (implemented)
- `kb_list_skills` (implemented)
- `kb_install_skill` (implemented)
- `kb_fix_skill` (implemented)

### Future candidates

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

### Phase 8 — install and iterate ✓

- install as a pi extension ✓
- remove auto-discovery of KB skills ✓
- add `install:skip` safeguard for the bundled self-skill ✓
- clean up dead cache code ✓
- verify tools work in live session ✓
- refine tags and authoring ergonomics

## Open questions

1. ~~Should the skill-source article body be only raw skill markdown, or should it allow wrapper sections around the skill payload?~~ Resolved: raw skill markdown with optional inner frontmatter
2. ~~Should the save tool accept doc content directly, or create a minimal doc article and let humans expand it later?~~ Resolved: accepts optional doc content, auto-generates when absent
3. ~~What cache location is best for portability and cleanup?~~ Resolved: project-local `.pi/agent/skills/` with fallback to `~/.pi/agent/skills/`
4. Should disabled skills remain listed but flagged, or be hidden entirely from `kb_list_skills`?
5. Should the extension support one doc article for multiple skill variants in later versions?
6. Should the parser be stricter or more lenient with malformed inner frontmatter?
7. Should references/assets be supported in v1, or deferred until the article format stabilizes?
