// THE package.json engines FIELD (release s). The test suite needs jsdom, whose own range is "^22.22.2 || ^24.15.0 || >=26.0.0" (the strictest of the test-only dependencies; CLAUDE.md used to say "22.19", which jsdom
// refuses). The field says so, the Node this suite runs on satisfies it, the Pages workflow's Node (24) satisfies it, and the field is exactly jsdom's own range, so it can never be looser than what the tests need.
// npm only warns when the running Node is outside the range (there is no engine-strict setting), so `npm ci` on Node 24 behaves as before.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const semver = require('semver');
const ROOT = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
const jsdomRange = lock.packages['node_modules/jsdom'].engines.node;
const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/deploy.yml'), 'utf8');

describe('package.json engines', () => {
  it('declares the Node range', () => { expect(pkg.engines).toEqual({ node: '^22.22.2 || ^24.15.0 || >=26.0.0' }); });
  it('is exactly the range jsdom (the strictest test dependency) declares in the lockfile', () => { expect(pkg.engines.node).toBe(jsdomRange); });
  it('is satisfied by the Node this suite is running on', () => { expect(semver.satisfies(process.version, pkg.engines.node), process.version).toBe(true); });
  it('admits the Node 24 the Pages workflow installs, and the old "22.19" claim is below it', () => {
    expect(workflow).toMatch(/node-version:\s*24\b/); expect(semver.satisfies('24.15.0', pkg.engines.node)).toBe(true); expect(semver.satisfies('24.99.0', pkg.engines.node)).toBe(true);
    expect(semver.satisfies('22.19.0', pkg.engines.node)).toBe(false); expect(semver.satisfies('22.22.2', pkg.engines.node)).toBe(true); expect(semver.satisfies('20.19.0', pkg.engines.node)).toBe(false);
  });
  it('every dependency in the lockfile that names a Node range admits a version the field admits (nothing in the tree is stricter than the field)', () => {
    const ranges = Object.entries(lock.packages).filter(([k, v]) => k && v.engines && v.engines.node && v.dev).map(([k, v]) => [k, v.engines.node]);
    const tooStrict = ranges.filter(([, r]) => !semver.satisfies('24.15.0', r) || !semver.satisfies('22.22.2', r)).map(([k, r]) => k + ' ' + r);
    expect(tooStrict).toEqual([]);
  });
  it('the workflow keeps the Sydney timezone and the Node 24 setting (this release does not touch the workflow)', () => { expect(workflow).toMatch(/TZ:\s*Australia\/Sydney/); expect(workflow).toMatch(/uses:\s*actions\/setup-node@v4/); });
});
