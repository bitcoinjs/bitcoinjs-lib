import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { compareArchives, describeArchive } from './verify-npm-release.mjs';

async function makeArchive(root, name, files) {
  const dir = join(root, name);
  await mkdir(join(dir, 'package'), { recursive: true });
  for (const [path, contents] of Object.entries(files)) {
    const p = join(dir, 'package', path);
    await mkdir(join(p, '..'), { recursive: true });
    await writeFile(p, contents);
  }
  const archive = join(root, `${name}.tgz`);
  execFileSync('tar', ['-czf', archive, '-C', dir, 'package']);
  return archive;
}

const common = { 'package.json': '{"name":"bitcoinjs-lib","version":"7.0.1"}', 'src/index.js': 'export const value = 1;\n' };
const withPair = async (fn, filesA = common, filesB = common) => {
  const temp = await mkdtemp(join(tmpdir(), 'bitcoinjs-npm-test-'));
  try {
    const a = await makeArchive(temp, 'source', filesA);
    const b = await makeArchive(temp, 'published', filesB);
    await fn(a, b, temp);
  } finally { await rm(temp, { recursive: true, force: true }); }
};

test('identical content matches despite different gzip metadata', async () => {
  await withPair(async (a, b) => {
    const result = await compareArchives(a, b);
    assert.equal(result.matched, true);
    assert.equal(result.sourceFiles, 2);
  });
});

test('detects modified source contents', async () => {
  await withPair(async (a, b) => {
    const result = await compareArchives(a, b);
    assert.deepEqual(result.different, ['src/index.js']);
    assert.equal(result.matched, false);
  }, common, { ...common, 'src/index.js': 'export const value = 2;\n' });
});

test('detects omitted and added files independently', async () => {
  await withPair(async (a, b) => {
    const result = await compareArchives(a, b);
    assert.deepEqual(result.missing, ['src/index.js']);
    assert.deepEqual(result.unexpected, ['src/extra.js']);
  }, common, { 'package.json': common['package.json'], 'src/extra.js': 'new' });
});

test('refuses symlinks rather than following their content', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'bitcoinjs-npm-symlink-'));
  try {
    const a = await makeArchive(temp, 'symlinks', common);
    const link = join(temp, 'symlinks', 'package', 'src', 'linked');
    const { symlink } = await import('node:fs/promises');
    await symlink('index.js', link);
    execFileSync('tar', ['-czf', a, '-C', join(temp, 'symlinks'), 'package']);
    await assert.rejects(describeArchive(a), /non-regular tar entry/);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('refuses unsafe parent traversal entry', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'bitcoinjs-npm-path-'));
  try {
    const a = await makeArchive(temp, 'base', common);
    // A fake member name is enough: the test intentionally does not extract it.
    const p = join(temp, 'malicious.tgz');
    execFileSync('tar', ['-czf', p, '--transform', 's@package/src/index.js@package/../escape.js@', '-C', join(temp, 'base'), 'package']);
    await assert.rejects(describeArchive(p), /Unsafe archive path/);
    assert.ok(a);
  } finally { await rm(temp, { recursive: true, force: true }); }
});
