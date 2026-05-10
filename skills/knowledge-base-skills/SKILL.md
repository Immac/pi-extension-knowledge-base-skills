---
name: knowledge-base-skills
description: Manages knowledge-base-backed pi skills — create skills stored as KB articles and explicitly install them to project or global pi skill directories.
---

You are an expert in the knowledge-base-skills pi extension. You know how to save skills as KB articles, materialize them into project-local `.pi/agent/skills/`, and validate skill-source articles.

## Two-article model

Each skill is represented by **two linked KB articles** sharing a `skill_ref`:

| Article | Type | Purpose |
|---------|------|---------|
| **Skill-source article** | `type:skill`, `kind:skill-source`, `skill:enabled` or `skill:disabled` | Machine-oriented — contains the raw SKILL.md body with embedded frontmatter (`name`, `description`). |
| **Documentation article** | `type:guide`, `kind:skill-doc` | Human-oriented — explains what the skill does, when to use it, examples, and links to the skill source. |

> **Design principle:** Skills are **explicitly installed**, not auto-loaded. Save a skill to the KB with `kb_save_skill`, then install it to your project or user scope with `kb_install_skill`.

## Tools

### `kb_save_skill` — Save a skill into the KB

Creates both linked articles automatically. Defaults to **local KB scope** (`./knowledge-base/`).

Required parameters:
- `skillName` — Lowercase kebab-case name (e.g. `debug-with-screenshots`)
- `skillContent` — Full SKILL.md with embedded frontmatter containing `name` (matches skillName) and `description`

Optional parameters:
- `docTitle` / `docContent` — Customize the companion documentation article
- `scope` — `"local"` (default, project KB) or `"global"` (`~/.pi/knowledge-base/`)
- `tags` — Additional comma-separated `key:value` pairs
- `enabled` — Set to `false` to create a disabled skill (saved to KB but not flagged for install)

**Example:**
```
kb_save_skill
  skillName: "my-analyzer"
  skillContent: "---\nname: my-analyzer\ndescription: Analyzes code structure\n---\n\nYou analyze code..."
  scope: local
  tags: "domain:code-analysis,tool:read"
```

### `kb_install_skill` — Install a KB skill to a pi skill directory

Takes a skill-source article slug and writes `SKILL.md` + `SOURCE.json` into the target directory.
Default: **local** (project `.pi/agent/skills/`). Use `scope:global` for user-wide (`~/.pi/agent/skills/`).

Required parameters:
- `articleSlug` — Slug of the skill-source article in the KB

Optional parameters:
- `scope` — `"local"` (default, project `.pi/agent/skills/`) or `"global"` (`~/.pi/agent/skills/`)

**Example:**
```
kb_install_skill
  articleSlug: "my-analyzer-skill-source"
  scope: local
```

### `kb_list_skills` — List skill-source articles in the KB

Scans the knowledge base for skill-source articles and shows their status, description, and validation issues.

Optional parameters:
- `scope` — `"local"` | `"global"` | `"all"` (default: `"all"`)
- `status` — `"enabled"` | `"disabled"` | `"all"` (default: `"all"`)
- `verbose` — Show detailed validation issues per skill (default: `false`)

**Example:**
```
kb_list_skills
  scope: global
  status: enabled
  verbose: true
```

### `kb_fix_skill` — Validate and repair a skill-source article

Checks a skill-source article for missing required tags and broken frontmatter, then repairs them automatically. Can also enable disabled skills and fix name/description mismatches.

Required parameters:
- `articleSlug` — Slug of the skill-source article to fix

Optional parameters:
- `fixTags` — Add missing required tags (type, kind, skill_ref, skill_name, audience, format, source). Default: `true`
- `fixFrontmatter` — Add or repair inner embedded frontmatter (name, description). Default: `true`
- `enable` — Change `skill:disabled` → `skill:enabled`
- `name` — Override skill name (updates both tag:skill_name and inner frontmatter)
- `description` — Override description (updates inner frontmatter description)
- `source` — Override source tag value (default: `"user"`)

**Example (fix a broken skill and enable it):**
```
kb_fix_skill
  articleSlug: "my-broken-skill-source"
  fixTags: true
  fixFrontmatter: true
  enable: true
  name: "my-fixed-skill"
  description: "A repaired skill"
```

**Example (preview issues):**
```
kb_list_skills
  scope: global
  verbose: true
```
See validation issues before fixing anything, then apply `kb_fix_skill` as needed.

## Install targets

| Scope | Directory |
|-------|-----------|
| `local` (default) | `<cwd>/.pi/agent/skills/<name>/` |
| `global` | `~/.pi/agent/skills/<name>/` |

## Tag schema reference

### Required tags for skill-source article

| Tag | Value | Purpose |
|-----|-------|---------|
| `type` | `skill` | Identifies as a skill definition |
| `kind` | `skill-source` | Distinguishes from doc articles |
| `skill` | `enabled` or `disabled` | Opt-in flag; only `enabled` loads |
| `skill_ref` | `<id>` | Shared identifier linking source + doc |
| `skill_name` | `<name>` | Runtime name for cache dir and SKILL.md |
| `audience` | `agent` | Marks as machine-oriented |
| `format` | `agent-skill` | Content format |
| `source` | `user` | Origin tracking |

### Required tags for documentation article

| Tag | Value | Purpose |
|-----|-------|---------|
| `type` | `guide` | Identifies as guidance content |
| `kind` | `skill-doc` | Distinguishes from source articles |
| `skill_ref` | `<id>` | Links to the skill-source article |
| `skill_name` | `<name>` | Reference to the skill name |
| `audience` | `human` | Marks as human-readable |

### Skill metadata (name + description)

The loader accepts `name` and `description` from two places:

1. **Inner frontmatter** (preferred) — an embedded `---` block within the article body:
   ```markdown
   ---
   name: my-skill
   description: Does X
   ---
   Body content...
   ```
2. **Outer article frontmatter** (fallback) — `name` and `description` fields in the article's own frontmatter, used when no inner frontmatter is present

## Validation checklist

When creating or editing a skill-source article, verify:

### Hard requirements (skip if missing)
- `type:skill`, `kind:skill-source`, `skill:enabled` tags present
- `skill_ref` and `skill_name` tags are non-empty
- `skill_name` matches `/^[a-z0-9]+(-[a-z0-9]+)*$/` (max 64 chars)
- Skill `name` (inner or outer) matches `skill_name` tag exactly
- `description` is non-empty
- Body content is non-empty

### Recommended
- `status:stable` or `status:draft` for lifecycle tracking
- `project:knowledge-base-skills` tag
- `domain:<topic>` tags for discovery
- `tool:<name>` tags for related tools

## Troubleshooting

### "description is required" or skill not loading

If pi shows this error after installing:
1. Check `<install-dir>/<name>/SKILL.md` — does it have `name:` and `description:` in frontmatter?
2. If not, the KB article lacks these fields — ensure the article has `name` and `description` either as inner frontmatter or as outer frontmatter fields
3. Clean the stale copy and re-install: `rm -rf ./pi/agent/skills/<name>` and run `kb_install_skill` again

### Skill not found after install

1. Verify the KB article has tags: `type:skill`, `kind:skill-source`
2. Ensure you used the correct `articleSlug`
3. Run `/reload` in pi to re-discover installed skills
4. Check `KB_SKILLS_KB_PATH` env var if the KB is at a custom path
