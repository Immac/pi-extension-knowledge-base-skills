import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { executeSaveSkill } from '../dist/save-skill.js';
import { executeMaterializeSkill } from '../dist/skill-materialize.js';
import { parseSkillSource } from '../dist/skill-source.js';
import { readArticle } from '../dist/kb.js';

// ── helpers ──

const KB_FLAG = 'KB_SKILLS_KB_PATH';

function withTempKb(files, fn) {
  const root = mkdtempSync(join(tmpdir(), 'kb-skills-test-'));
  const kbPath = join(root, 'kb');
  mkdirSync(kbPath, { recursive: true });
  for (const [slug, content] of Object.entries(files)) {
    writeFileSync(join(kbPath, `${slug}.md`), content, 'utf8');
  }
  const prev = process.env[KB_FLAG];
  process.env[KB_FLAG] = kbPath;
  try {
    fn(kbPath);
  } finally {
    process.env[KB_FLAG] = prev;
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

// ── kb_save_skill tests ──

test('save-skill: creates both linked articles in local scope', () => {
  const root = mkdtempSync(join(tmpdir(), 'kb-skills-test-'));
  const kbPath = join(root, 'kb');
  mkdirSync(join(kbPath, 'articles'), { recursive: true }); // force folder layout
  const prev = process.env[KB_FLAG];
  process.env[KB_FLAG] = kbPath;

  try {
    const result = executeSaveSkill({
      skillName: 'test-skill',
      skillContent: '---\nname: test-skill\ndescription: A test skill.\n---\n\nYou are a test skill.',
      scope: 'local',
    });

    assert.equal(result.success, true);
    assert.ok(result.skillSlug, 'should have skill slug');
    assert.ok(result.docSlug, 'should have doc slug');
    assert.equal(result.skillRef, 'test-skill');
    assert.match(result.skillSlug, /test-skill/);

    // Verify skill-source article was written (folder layout)
    const skillPath = join(kbPath, 'articles', result.skillSlug, 'ARTICLE.md');
    assert.equal(existsSync(skillPath), true, 'skill-source article should exist on disk');
    const skillRaw = readFileSync(skillPath, 'utf8');
    assert.ok(skillRaw.includes('type:skill'), 'should have type:skill tag');
    assert.ok(skillRaw.includes('skill:enabled'), 'should be enabled');
    assert.ok(skillRaw.includes('skill_name:test-skill'), 'should have skill_name');

    // Verify doc article was written
    const docPath = join(kbPath, 'articles', result.docSlug, 'ARTICLE.md');
    assert.equal(existsSync(docPath), true, 'doc article should exist on disk');
    const docRaw = readFileSync(docPath, 'utf8');
    assert.ok(docRaw.includes('type:guide'), 'should have type:guide tag');
    assert.ok(docRaw.includes('kind:skill-doc'), 'should have kind:skill-doc tag');
    assert.ok(docRaw.includes('audience:human'), 'doc should be audience:human');
  } finally {
    process.env[KB_FLAG] = prev;
    rmSync(root, { recursive: true, force: true });
  }
});

test('save-skill: creates disabled skill when enabled:false', () => {
  const root = mkdtempSync(join(tmpdir(), 'kb-skills-test-'));
  const kbPath = join(root, 'kb');
  mkdirSync(join(kbPath, 'articles'), { recursive: true });
  const prev = process.env[KB_FLAG];
  process.env[KB_FLAG] = kbPath;

  try {
    const result = executeSaveSkill({
      skillName: 'disabled-test',
      skillContent: '---\nname: disabled-test\ndescription: A disabled skill.\n---\n\nBody.',
      scope: 'local',
      enabled: false,
    });

    assert.equal(result.success, true);
    assert.ok(result.skillSlug);
    const skillRaw = readFileSync(join(kbPath, 'articles', result.skillSlug, 'ARTICLE.md'), 'utf8');
    assert.ok(skillRaw.includes('skill:disabled'), 'should be disabled');
    assert.ok(!skillRaw.includes('skill:enabled'), 'should not be enabled');
  } finally {
    process.env[KB_FLAG] = prev;
    rmSync(root, { recursive: true, force: true });
  }
});

test('save-skill: passes extra tags to both articles', () => {
  const root = mkdtempSync(join(tmpdir(), 'kb-skills-test-'));
  const kbPath = join(root, 'kb');
  mkdirSync(join(kbPath, 'articles'), { recursive: true });
  const prev = process.env[KB_FLAG];
  process.env[KB_FLAG] = kbPath;

  try {
    const result = executeSaveSkill({
      skillName: 'tagged',
      skillContent: '---\nname: tagged\ndescription: Has tags.\n---\n\nBody.',
      scope: 'local',
      tags: 'domain:testing,status:stable',
    });

    assert.equal(result.success, true);
    assert.ok(result.skillSlug);
    assert.ok(result.docSlug);
    const skillRaw = readFileSync(join(kbPath, 'articles', result.skillSlug, 'ARTICLE.md'), 'utf8');
    assert.ok(skillRaw.includes('domain:testing'), 'should pass domain tag');
    assert.ok(skillRaw.includes('status:stable'), 'should pass status tag');

    const docRaw = readFileSync(join(kbPath, 'articles', result.docSlug, 'ARTICLE.md'), 'utf8');
    assert.ok(docRaw.includes('domain:testing'), 'doc should also have domain tag');
    assert.ok(docRaw.includes('status:stable'), 'doc should also have status tag');
  } finally {
    process.env[KB_FLAG] = prev;
    rmSync(root, { recursive: true, force: true });
  }
});

test('save-skill: rejects invalid skill name', () => {
  const result = executeSaveSkill({
    skillName: 'Invalid Name WITH Spaces',
    skillContent: '---\nname: Invalid Name WITH Spaces\ndescription: Bad.\n---\n\nBody.',
  });
  assert.equal(result.success, false);
  assert.ok(result.error.includes('Invalid skill name'));
});

test('save-skill: rejects empty content', () => {
  const result = executeSaveSkill({
    skillName: 'empty-test',
    skillContent: '   ',
  });
  assert.equal(result.success, false);
  assert.ok(result.error.includes('skillContent is required'));
});

test('save-skill: rejects name mismatch between param and frontmatter', () => {
  const result = executeSaveSkill({
    skillName: 'expected-name',
    skillContent: '---\nname: different-name\ndescription: Mismatched.\n---\n\nBody.',
  });
  assert.equal(result.success, false);
  assert.ok(result.error.includes('name mismatch'));
});

test('save-skill: rejects missing description in frontmatter', () => {
  const result = executeSaveSkill({
    skillName: 'no-desc',
    skillContent: '---\nname: no-desc\ndescription:  \n---\n\nBody.',
  });
  assert.equal(result.success, false);
  assert.ok(result.error.includes('description'));
});

// ── kb_install_skill tests ──

test('install-skill: writes SKILL.md and SOURCE.json to global scope', () => {
  const root = mkdtempSync(join(tmpdir(), 'kb-skills-test-'));
  const installRoot = mkdtempSync(join(tmpdir(), 'kb-skills-install-'));

  const origHome = process.env.HOME;
  process.env.HOME = installRoot;

  withTempKb({
    'my-helper-source': makeSkillArticle({ name: 'my-helper', description: 'A helper skill' }),
  }, (kbPath) => {
    try {
      const result = executeMaterializeSkill({
        articleSlug: 'my-helper-source',
        scope: 'global',
      });

      assert.equal(result.success, true);
      assert.equal(result.skillName, 'my-helper');

      const skillDir = join(installRoot, '.pi', 'agent', 'skills', 'my-helper');
      assert.equal(result.outputPath, skillDir);

      // Check SKILL.md
      const skillMd = readFileSync(join(skillDir, 'SKILL.md'), 'utf8');
      assert.ok(skillMd.includes('name: my-helper'), 'should have name in frontmatter');
      assert.ok(skillMd.includes('description: A helper skill'), 'should have description in frontmatter');
      assert.ok(skillMd.includes('You are a my-helper expert'), 'should have body content');

      // Check SOURCE.json
      const sourceJson = JSON.parse(readFileSync(join(skillDir, 'SOURCE.json'), 'utf8'));
      assert.equal(sourceJson.skillName, 'my-helper');
      assert.equal(sourceJson.skillRef, 'my-helper');
      assert.equal(sourceJson.articleSlug, 'my-helper-source');
      assert.ok(sourceJson.articlePath.includes('my-helper-source'));
    } finally {
      process.env.HOME = origHome;
    }
  });
});

test('install-skill: prepends frontmatter when article body lacks inner frontmatter', () => {
  const root = mkdtempSync(join(tmpdir(), 'kb-skills-test-'));
  const installRoot = mkdtempSync(join(tmpdir(), 'kb-skills-install-'));

  const origHome = process.env.HOME;
  process.env.HOME = installRoot;

  withTempKb({
    'bare-source': [
      '---',
      'title: Bare Skill',
      'tags:',
      '  - type:skill',
      '  - kind:skill-source',
      '  - skill:enabled',
      '  - skill_ref:bare-skill',
      '  - skill_name:bare-skill',
      '  - audience:agent',
      '  - format:agent-skill',
      '  - source:user',
      '---',
      '',
      'Just body text, no inner frontmatter.',
    ].join('\n'),
  }, (kbPath) => {
    try {
      const result = executeMaterializeSkill({
        articleSlug: 'bare-source',
        scope: 'global',
      });

      assert.equal(result.success, true);
      const skillMd = readFileSync(join(installRoot, '.pi', 'agent', 'skills', 'bare-skill', 'SKILL.md'), 'utf8');
      // Should prepend frontmatter from outer article fields
      assert.ok(skillMd.startsWith('---'), 'should have frontmatter');
      assert.ok(skillMd.includes('name: bare-skill'), 'should have name from outer fm');
    } finally {
      process.env.HOME = origHome;
    }
  });
});

test('install-skill: error when article does not exist', () => {
  const result = executeMaterializeSkill({ articleSlug: 'no-such-article' });
  assert.equal(result.success, false);
  assert.ok(result.error.includes('not found'));
});

test('install-skill: error when article is not a valid skill-source', () => {
  withTempKb({
    'not-a-skill': [
      '---',
      'title: Just an article',
      'tags:',
      '  - type:guide',
      '---',
      '',
      'Not a skill.',
    ].join('\n'),
  }, () => {
    const result = executeMaterializeSkill({ articleSlug: 'not-a-skill' });
    assert.equal(result.success, false);
    assert.ok(result.error.includes('not a valid skill-source'));
  });
});

// ── install:skip safeguard tests ──

test('install-skip: parseSkillSource skips articles tagged install:skip by default', () => {
  withTempKb({
    'skip-source': makeSkillArticle({ name: 'skip-me', description: 'Should skip', extraTags: '  - install:skip' }),
    'normal-source': makeSkillArticle({ name: 'normal', description: 'Should load' }),
  }, (kbPath) => {
    const skipArticle = readArticle('skip-source', kbPath);
    const normalArticle = readArticle('normal-source', kbPath);

    assert.ok(skipArticle, 'skip article should be readable');
    assert.ok(normalArticle, 'normal article should be readable');

    // Without allowSkip — should return null for install:skip
    const skipResult = parseSkillSource(skipArticle);
    assert.equal(skipResult, null, 'install:skip article should be skipped by default');

    // Normal article without install:skip should still work
    const normalResult = parseSkillSource(normalArticle);
    assert.ok(normalResult, 'normal article should be parsed');
    assert.equal(normalResult.skillName, 'normal');

    // With allowSkip: true — should parse the skip article
    const skipWithAllow = parseSkillSource(skipArticle, { allowSkip: true });
    assert.ok(skipWithAllow, 'install:skip article should parse with allowSkip:true');
    assert.equal(skipWithAllow.skillName, 'skip-me');
  });
});
