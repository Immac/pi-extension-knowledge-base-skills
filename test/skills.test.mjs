import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// We test the compiled JS, not TS source
import { executeListSkills, formatListSkillsResult } from '../dist/list-skills.js';
import { executeFixSkill, formatFixSkillResult } from '../dist/fix-skill.js';

// ── helpers ──

const GLOBAL_FLAG = 'KB_SKILLS_KB_PATH';

function withTempKb(files, fn) {
  const root = mkdtempSync(join(tmpdir(), 'kb-skills-test-'));
  const kbPath = join(root, 'kb');
  mkdirSync(kbPath, { recursive: true });
  for (const [slug, content] of Object.entries(files)) {
    writeFileSync(join(kbPath, `${slug}.md`), content, 'utf8');
  }
  const prev = process.env[GLOBAL_FLAG];
  process.env[GLOBAL_FLAG] = kbPath;
  try {
    fn(kbPath);
  } finally {
    process.env[GLOBAL_FLAG] = prev;
    rmSync(root, { recursive: true, force: true });
  }
}

function makeSkillArticle({ name, description, enabled = true, extraTags = '' }) {
  const skill = enabled ? 'enabled' : 'disabled';
  return [
    '---',
    'title: ' + name + ' — Skill Source',
    'tags:',
    '  - type:skill',
    '  - kind:skill-source',
    '  - skill:' + skill,
    '  - skill_ref:' + name,
    '  - skill_name:' + name,
    '  - audience:agent',
    '  - format:agent-skill',
    '  - source:user',
    extraTags,
    '---',
    '',
    '---',
    'name: ' + name,
    'description: ' + description,
    '---',
    '',
    'You are a ' + name + ' expert.',
    '',
  ].filter(l => l).join('\n');
}

// ── kb_list_skills tests ──

test('list-skills: returns empty when no KB exists', () => {
  const root = mkdtempSync(join(tmpdir(), 'kb-skills-test-'));
  const prev = process.env[GLOBAL_FLAG];
  process.env[GLOBAL_FLAG] = join(root, 'nonexistent');
  try {
    const result = executeListSkills({});
    assert.equal(result.skills.length, 0);
  } finally {
    process.env[GLOBAL_FLAG] = prev;
    rmSync(root, { recursive: true, force: true });
  }
});

test('list-skills: lists enabled skills', () => {
  withTempKb({
    'hello-source': makeSkillArticle({ name: 'hello', description: 'Greeter skill' }),
    'nope': [
      '---',
      'title: just an article',
      'tags:',
      '  - type:guide',
      '---',
      '',
      'Not a skill.',
    ].join('\n'),
  }, () => {
    const result = executeListSkills({});
    assert.equal(result.skills.length, 1);
    assert.equal(result.skills[0].skillName, 'hello');
    assert.equal(result.skills[0].enabled, true);
    assert.equal(result.skills[0].isQualified, true);
    assert.equal(result.skills[0].issues.length, 0);
  });
});

test('list-skills: filter by disabled status', () => {
  withTempKb({
    'enabled-source': makeSkillArticle({ name: 'enabled-skill', description: 'Active' }),
    'disabled-source': makeSkillArticle({ name: 'disabled-skill', description: 'Inactive', enabled: false }),
  }, () => {
    const all = executeListSkills({ status: 'all' });
    assert.equal(all.skills.length, 2);

    const enabled = executeListSkills({ status: 'enabled' });
    assert.equal(enabled.skills.length, 1);
    assert.equal(enabled.skills[0].skillName, 'enabled-skill');

    const disabled = executeListSkills({ status: 'disabled' });
    assert.equal(disabled.skills.length, 1);
    assert.equal(disabled.skills[0].skillName, 'disabled-skill');
  });
});

test('list-skills: detects missing required tags', () => {
  withTempKb({
    'broken-source': [
      '---',
      'title: Broken skill',
      'tags:',
      '  - type:skill',
      '  - kind:skill-source',
      '  - skill:enabled',
      // missing skill_ref, skill_name, audience, format, source
      '---',
      '',
      '---',
      'name: broken',
      'description: A broken skill.',
      '---',
      '',
      'body.',
    ].join('\n'),
  }, () => {
    const result = executeListSkills({ verbose: true });
    assert.equal(result.skills.length, 1);
    const s = result.skills[0];
    assert.equal(s.isQualified, false);

    const missingTags = s.issues.filter(i => i.field.startsWith('tag:'));
    const missingKeys = missingTags.map(i => i.field);
    assert.ok(missingKeys.includes('tag:skill_ref'));
    assert.ok(missingKeys.includes('tag:skill_name'));
    assert.ok(missingKeys.includes('tag:audience'));
    assert.ok(missingKeys.includes('tag:format'));
    assert.ok(missingKeys.includes('tag:source'));
  });
});

test('list-skills: detects name mismatch', () => {
  withTempKb({
    'mismatch-source': [
      '---',
      'title: Mismatched skill',
      'tags:',
      '  - type:skill',
      '  - kind:skill-source',
      '  - skill:enabled',
      '  - skill_ref:mismatch',
      '  - skill_name:mismatch',
      '  - audience:agent',
      '  - format:agent-skill',
      '  - source:user',
      '---',
      '',
      '---',
      'name: different-name',  // doesn't match skill_name
      'description: A mismatch.',
      '---',
      '',
      'body.',
    ].join('\n'),
  }, () => {
    const result = executeListSkills({});
    assert.equal(result.skills.length, 1);
    const s = result.skills[0];
    assert.equal(s.isQualified, false);
    assert.ok(s.issues.some(i => i.field === 'name' && i.message.includes('different-name')));
  });
});

test('list-skills: verbose flag shows issues', () => {
  withTempKb({
    'bad-source': [
      '---',
      'title: Bad',
      'tags:',
      '  - type:skill',
      '  - kind:skill-source',
      '  - skill:enabled',
      '  - skill_ref:bad',
      '  - skill_name:bad',
      '  - audience:agent',
      '  - format:agent-skill',
      '  - source:user',
      '---',
      '',
      // no inner frontmatter, no name/description
      'body.',
    ].join('\n'),
  }, () => {
    const compact = formatListSkillsResult(executeListSkills({}), false);
    assert.ok(!compact.includes('🔴'));  // issues hidden in non-verbose

    const verbose = formatListSkillsResult(executeListSkills({}), true);
    assert.ok(verbose.includes('🔴'));   // issues visible in verbose
    assert.ok(verbose.includes('name')); // mentions the name issue
  });
});

// ── kb_fix_skill tests ──

test('fix-skill: returns error for non-existent article', () => {
  const result = executeFixSkill({ articleSlug: 'no-such-article' });
  assert.equal(result.success, false);
  assert.ok(result.error.includes('not found'));
});

test('fix-skill: no changes when skill is already valid', () => {
  withTempKb({
    'valid-source': makeSkillArticle({ name: 'valid', description: 'Already valid' }),
  }, (kbPath) => {
    const result = executeFixSkill({
      articleSlug: 'valid-source',
      fixTags: true,
      fixFrontmatter: true,
    });
    assert.equal(result.success, true);
    assert.equal(result.actions.length, 0);
  });
});

test('fix-skill: adds missing required tags', () => {
  withTempKb({
    'missing-tags-source': [
      '---',
      'title: Missing Tags',
      'tags:',
      '  - type:skill',
      '  - kind:skill-source',
      '  - skill:enabled',
      // missing skill_ref, skill_name, audience, format, source
      '---',
      '',
      '---',
      'name: missing-tags',
      'description: Missing some tags.',
      '---',
      '',
      'body.',
    ].join('\n'),
  }, (kbPath) => {
    const result = executeFixSkill({
      articleSlug: 'missing-tags-source',
      fixTags: true,
    });
    assert.equal(result.success, true);
    const addedTags = result.actions.filter(a => a.type === 'tag_added');
    assert.ok(addedTags.length >= 4);  // skill_ref, skill_name, audience, format, source, (skill already present)

    // Verify file was updated
    const raw = readFileSync(join(kbPath, 'missing-tags-source.md'), 'utf8');
    assert.ok(raw.includes("skill_ref:missing-tags-source"));
    assert.ok(raw.includes("skill_name:missing-tags-source"));
    assert.ok(raw.includes("audience:agent"));
    assert.ok(raw.includes("format:agent-skill"));
  });
});

test('fix-skill: adds inner frontmatter when missing', () => {
  withTempKb({
    'no-fm-source': [
      '---',
      'title: No Frontmatter',
      'tags:',
      '  - type:skill',
      '  - kind:skill-source',
      '  - skill:enabled',
      '  - skill_ref:no-fm',
      '  - skill_name:no-fm',
      '  - audience:agent',
      '  - format:agent-skill',
      '  - source:user',
      '---',
      '',
      'Body text with no inner frontmatter.',
    ].join('\n'),
  }, (kbPath) => {
    const result = executeFixSkill({
      articleSlug: 'no-fm-source',
      fixFrontmatter: true,
      name: 'no-fm',
      description: 'Fixed description',
    });
    assert.equal(result.success, true);
    assert.ok(result.actions.some(a => a.type === 'frontmatter_added'));

    // Verify file was updated
    const raw = readFileSync(join(kbPath, 'no-fm-source.md'), 'utf8');
    assert.ok(raw.includes('name: no-fm'));
    assert.ok(raw.includes('description: Fixed description'));
  });
});

test('fix-skill: enables disabled skill', () => {
  withTempKb({
    'disabled-source': makeSkillArticle({ name: 'disabled-skill', description: 'Was disabled', enabled: false }),
  }, (kbPath) => {
    const result = executeFixSkill({
      articleSlug: 'disabled-source',
      enable: true,
    });
    assert.equal(result.success, true);
    assert.ok(result.actions.some(a => a.type === 'tag_enabled'));

    const raw = readFileSync(join(kbPath, 'disabled-source.md'), 'utf8');
    assert.ok(raw.includes('skill:enabled'));
    assert.ok(!raw.includes('skill:disabled'));
  });
});

test('fix-skill: fixes name mismatch', () => {
  withTempKb({
    'misnamed-source': [
      '---',
      'title: Misnamed',
      'tags:',
      '  - type:skill',
      '  - kind:skill-source',
      '  - skill:enabled',
      '  - skill_ref:misnamed',
      '  - skill_name:misnamed',
      '  - audience:agent',
      '  - format:agent-skill',
      '  - source:user',
      '---',
      '',
      '---',
      'name: wrong-name',
      'description: Wrong name.',
      '---',
      '',
      'body.',
    ].join('\n'),
  }, (kbPath) => {
    const result = executeFixSkill({
      articleSlug: 'misnamed-source',
      fixFrontmatter: true,
      name: 'misnamed',
    });
    assert.equal(result.success, true);
    assert.ok(result.actions.some(a => a.type === 'frontmatter_fixed'));

    const raw = readFileSync(join(kbPath, 'misnamed-source.md'), 'utf8');
    assert.ok(raw.includes('name: misnamed'));  // fixed
    assert.ok(!raw.includes('name: wrong-name'));  // removed
  });
});

test('fix-skill: combined fix — missing tags, missing frontmatter, disabled', () => {
  withTempKb({
    'trashed-source': [
      '---',
      'title: Trashed',
      'tags:',
      '  - type:skill',
      '  - kind:skill-source',
      '  - skill:disabled',
      // no skill_ref, skill_name, audience, format, source
      '---',
      '',
      '---',
      'name: trashed',
      // no description
      '---',
      '',
      'bare body.',
    ].join('\n'),
  }, (kbPath) => {
    const result = executeFixSkill({
      articleSlug: 'trashed-source',
      fixTags: true,
      fixFrontmatter: true,
      enable: true,
      name: 'trashed',
      description: 'Resurrected',
    });
    assert.equal(result.success, true);

    const tagAdds = result.actions.filter(a => a.type === 'tag_added');
    const tagEnable = result.actions.filter(a => a.type === 'tag_enabled');
    const fmFixes = result.actions.filter(a => a.type === 'frontmatter_added' || a.type === 'frontmatter_fixed');

    assert.ok(tagAdds.length >= 4, 'should have added missing tags');
    assert.equal(tagEnable.length, 1, 'should have enabled');
    assert.ok(fmFixes.length >= 1, 'should have fixed frontmatter');

    const raw = readFileSync(join(kbPath, 'trashed-source.md'), 'utf8');
    assert.ok(raw.includes('skill:enabled'));
    assert.ok(raw.includes('description: Resurrected'));
    assert.ok(raw.includes('skill_name:trashed'));
    assert.ok(raw.includes('audience:agent'));
  });
});

test('fix-skill: handles malformed inner frontmatter (no closing ---)', () => {
  withTempKb({
    'malformed-source': [
      '---',
      'title: Malformed',
      'tags:',
      '  - type:skill',
      '  - kind:skill-source',
      '  - skill:enabled',
      '  - skill_ref:malformed',
      '  - skill_name:malformed',
      '  - audience:agent',
      '  - format:agent-skill',
      '  - source:user',
      '---',
      '',
      '---',
      'name: malformed',
      'description: This has no closing fm',
      '',
    ].join('\n'),
  }, (kbPath) => {
    const result = executeFixSkill({
      articleSlug: 'malformed-source',
      fixFrontmatter: true,
      name: 'malformed',
      description: 'Fixed',
    });
    assert.equal(result.success, true);
    assert.ok(result.actions.some(a => a.type === 'frontmatter_added'));

    const raw = readFileSync(join(kbPath, 'malformed-source.md'), 'utf8');
    assert.ok(raw.includes('name: malformed'));
    assert.ok(raw.includes('description: Fixed'));
  });
});
