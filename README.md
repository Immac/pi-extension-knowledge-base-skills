# knowledge-base-skills

A separate pi extension for skill-related workflows that build on top of the knowledge base.

## Current scope

- discover enabled skill-source articles from a knowledge base
- generate cache-backed `SKILL.md` directories
- contribute those generated directories through `resources_discover`

## How it works

By default the extension scans:

- `~/.pi/knowledge-base` for articles
- `~/.cache/pi/kb-skills` for generated runtime skill folders

Set these environment variables to override the locations:

- `KB_SKILLS_KB_PATH`
- `KB_SKILLS_CACHE_PATH`

## What qualifies as a skill source

An article must include tags like:

- `type:skill`
- `kind:skill-source`
- `skill:enabled`
- `skill_ref:<id>`
- `skill_name:<runtime-name>`

Its body must contain valid skill markdown, including a `SKILL.md`-style frontmatter block with `name` and `description`.

## Output

Each discovered skill is materialized as:

- `<cache>/<skill-name>/SKILL.md`
- `<cache>/<skill-name>/SOURCE.json`
