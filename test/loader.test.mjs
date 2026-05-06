import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { discoverSkillSources, refreshSkillCache } from '../dist/loader.js';

function makeKb(root) {
  const kbPath = join(root, 'kb');
  mkdirSync(kbPath, { recursive: true });
  return kbPath;
}

test('discovers enabled skill-source articles and caches them as SKILL.md folders', () => {
  const root = mkdtempSync(join(tmpdir(), 'kb-skills-'));
  const kbPath = makeKb(root);
  const cacheRoot = join(root, 'cache');

  writeFileSync(
    join(kbPath, 'helllllo-source.md'),
    [
      '---',
      'title: HELLLLLO skill source',
      'tags:',
      '  - type:skill',
      '  - kind:skill-source',
      '  - skill:enabled',
      '  - skill_ref:hello-test',
      '  - skill_name:helllllo',
      '---',
      '',
      '---',
      'name: helllllo',
      'description: Says HELLLLLO and nothing else.',
      '---',
      '',
      'HELLLLLO',
      '',
    ].join('\n'),
    'utf8'
  );

  writeFileSync(
    join(kbPath, 'not-a-skill.md'),
    [
      '---',
      'title: regular article',
      'tags:',
      '  - type:guide',
      '---',
      '',
      'This should not load as a skill.',
      '',
    ].join('\n'),
    'utf8'
  );

  const config = { knowledgeBasePath: kbPath, cacheRoot };
  const discovered = discoverSkillSources(config);
  assert.equal(discovered.length, 1);
  assert.equal(discovered[0].skillName, 'helllllo');
  assert.match(discovered[0].skillDescription, /Says HELLLLLO/);

  const generatedPaths = refreshSkillCache(config);
  assert.equal(generatedPaths.length, 1);
  assert.equal(existsSync(join(cacheRoot, 'helllllo', 'SKILL.md')), true);
  assert.equal(existsSync(join(cacheRoot, 'helllllo', 'SOURCE.json')), true);
  assert.match(readFileSync(join(cacheRoot, 'helllllo', 'SKILL.md'), 'utf8'), /name: helllllo/);

  rmSync(root, { recursive: true, force: true });
});
