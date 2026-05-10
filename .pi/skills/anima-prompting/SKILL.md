---
name: anima-prompting
description: anima-prompting — Skill
---

# Anima Prompting Skill

You are helping with CircleStone Labs' Anima model. Anima uses Danbooru-style tags in a specific prompt order. Below are the rules and conventions.

## Prompt Order

```
[quality/meta/year/safety] [1girl/1boy/1other] [character] [series] [artist@] [general tags]
       Slot 1               Slot 2          Slot 3     Slot 4     Slot 5       Slot 6
```

## Conventions

- Lowercase, **spaces** not underscores (use `long hair`, not `long_hair`)
- Exception: score tags use underscores (`score_9`, `score_8`)
- Artist prefix: `@` (e.g. `@dairi`)
- Separate tags with commas

## Recommended Negative

```
worst aesthetics, worst quality, low quality, old
```

If negating something specific, add it at the **start** of the negative:
```
horrible hands, extra fingers, worst aesthetics, worst quality, low quality, old
```

## Positive Prompt — General Advice

- **Don't** add quality tags (`masterpiece`, `best quality`) to the positive
- **Do** add year tags: `newest`, `recent`, `mid` (controls training era)
- Exception: use `old` or `early` for retro artists like `@toriyama akira` or `@sugimori ken`
- **Don't** add tags you don't need — simpler prompts work better
- Keep negative simple unless you have something specific to negate

## Year Tag Guide

| Tag | Effect |
|-----|--------|
| `newest` | Most recent training data (modern styles) |
| `recent` | Recent training data |
| `mid` | Mid-range (good default) |
| `early` / `old` | Older training data (retro styles) |

## Tag Caveats

Some tags have special requirements. Check `output/tag_notes.json` in the danbooru-anima-tags repo for known caveats. If a specific artist or tag is mentioned, always read that file to see if there are notes.

## Artist Combos

Some artist combinations produce known good results. Check `output/artist_combos.json` in the repo for discovered combos with weights.

## Data Files

To check:
```bash
cat /home/immac/projects/danbooru-anima-tags/output/tag_notes.json
cat /home/immac/projects/danbooru-anima-tags/output/artist_combos.json
```

The full prompting guide with tag groups and top artists is in the KB article `anima-prompting-guide-danbooru-tag-reference`.

## Slot Reference

**Slot 1** — Quality, meta, year & safety:
`worst aesthetics, worst quality, low quality, normal quality, good quality, best quality, masterpiece`
`score_9` through `score_1` (use underscores)
`newest, recent, mid, early, old`
`safe, sensitive, nsfw, explicit`
`highres, absurdres, official art, anime screenshot, jpeg artifacts`

**Slot 2** — Gender & character count:
`1girl, solo, 1boy, 1other, multiple girls, multiple boys, no humans`
Also: `no bra, no shoes, no panties, no pants, no shirt`

**Slot 3** — Character names (57K+ known):
`hatsune miku, sailor moon, 2b (nier), tifa lockhart`

**Slot 4** — Series/copyright (12K+ known):
`vocaloid, genshin impact, final fantasy, touhou, azur lane`

**Slot 5** — Artists with @ prefix (83K+ known, 5K+ with 300+ posts):
`@dairi, @ebifurya, @wlop, @asanagi, @dishwasher1910`

**Slot 6** — General tags (~37K organized into ~100 tag groups):
Hair, eyes, clothing, poses, expressions, backgrounds, objects, etc.
