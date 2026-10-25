#!/usr/bin/env node
// Compare the published npm package to the package built from an audited,
// clean, exact release-tag checkout, without executing package lifecycle code.
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const MAX_ARCHIVE_BYTES = 100 * 1024 * 1024;
const MAX_MEMBER_BYTES = 64 * 1024 * 1024;
const MAX_TOTAL_CONTENT_BYTES = 256 * 1024 * 1024;
const MAX_LIST_BYTES = 8 * 1024 * 1024;

async function command(executable, args, { cwd, maxBytes = MAX_LIST_BYTES } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(executable, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    const buffers = [];
    const errors = [];
    let length = 0;
    let failure = null;
    child.on('error', reject);
    child.stdout.on('data', b => {
      length += b.length;
      if (length > maxBytes) {
        failure = new Error(`${executable} output exceeds limit`);
        child.kill();
      } else buffers.push(b);
    });
    child.stderr.on('data', b => {
      if (Buffer.concat(errors).length < 4096) errors.push(b);
    });
    child.on('close', code => {
      if (failure) return reject(failure);
      if (code !== 0) return reject(new Error(`${executable} exited ${code}: ${Buffer.concat(errors).toString().slice(0, 1500)}`));
      resolvePromise(Buffer.concat(buffers).toString('utf8').trimEnd());
    });
  });
}

function archiveName(name) {
  if (!name.startsWith('package/') || name.endsWith('/') || name.includes('\\') || /[\x00-\x1f\x7f]/.test(name)) {
    throw new Error(`Unexpected archive file name: ${JSON.stringify(name)}`);
  }
  const pieces = name.slice('package/'.length).split('/');
  if (pieces.some(part => !part || part === '.' || part === '..')) throw new Error('Unsafe archive path');
  return pieces.join('/');
}

async function hashMember(archive, member) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('tar', ['-xOzf', archive, '--', member], { stdio: ['ignore', 'pipe', 'pipe'] });
    const hash = createHash('sha256');
    let count = 0;
    let stderr = '';
    let failed = false;
    child.on('error', reject);
    child.stdout.on('data', b => {
      count += b.length;
      if (count > MAX_MEMBER_BYTES) {
        failed = true;
        child.kill();
      } else hash.update(b);
    });
    child.stderr.on('data', b => { stderr += b.toString().slice(0, 500); });
    child.on('close', code => {
      if (failed) return reject(new Error(`Tar member exceeds safety limit: ${member}`));
      if (code !== 0) return reject(new Error(`Failed to read ${member} (tar ${code}): ${stderr}`));
      resolvePromise({ sha256: hash.digest('hex'), bytes: count });
    });
  });
}

export async function describeArchive(file) {
  const archive = resolve(file);
  const info = await stat(archive);
  if (!info.isFile() || info.size > MAX_ARCHIVE_BYTES) throw new Error('Tarball exceeds safety limit');
  const list = (await command('tar', ['-tzf', archive])).split('\n');
  const verbose = (await command('tar', ['-tzvf', archive])).split('\n');
  if (list.length !== verbose.length) throw new Error('Cannot match tar entry names and types');
  const entries = new Map();
  let totalBytes = 0;
  for (let i = 0; i < list.length; i++) {
    const name = list[i];
    const type = verbose[i][0];
    if (name.endsWith('/') && type === 'd') continue;
    if (type !== '-') throw new Error(`Refusing non-regular tar entry ${JSON.stringify(name)} (${type})`);
    const short = archiveName(name);
    if (entries.has(short)) throw new Error(`Duplicate archive entry ${short}`);
    const record = await hashMember(archive, name);
    totalBytes += record.bytes;
    if (totalBytes > MAX_TOTAL_CONTENT_BYTES) throw new Error('Total unpacked contents exceed safety limit');
    entries.set(short, record);
  }
  if (!entries.has('package.json')) throw new Error('No package.json in tarball');
  return entries;
}

export async function compareArchives(sourceArchive, publishedArchive) {
  const [source, published] = await Promise.all([describeArchive(sourceArchive), describeArchive(publishedArchive)]);
  const missing = [...source.keys()].filter(name => !published.has(name)).sort();
  const unexpected = [...published.keys()].filter(name => !source.has(name)).sort();
  const different = [...source.keys()].filter(name => published.has(name) && source.get(name).sha256 !== published.get(name).sha256).sort();
  return { matched: !missing.length && !unexpected.length && !different.length, sourceFiles: source.size, publishedFiles: published.size, missing, unexpected, different };
}

async function verifyPackage(version) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) throw new Error('Version must be an exact npm version, not a tag or range');
  const manifest = JSON.parse(await readFile('package.json', 'utf8'));
  if (manifest.name !== 'bitcoinjs-lib' || manifest.version !== version) throw new Error('Local package name/version does not match requested npm release');
  const root = await command('git', ['rev-parse', '--show-toplevel']);
  if (resolve(root) !== process.cwd()) throw new Error('Run at the Git repository root');
  if (await command('git', ['status', '--porcelain', '--untracked-files=all'])) throw new Error('Source checkout must be clean to avoid comparing unintended files');
  const tags = (await command('git', ['tag', '--points-at', 'HEAD'])).split('\n');
  if (![version, `v${version}`].some(tag => tags.includes(tag))) throw new Error(`HEAD must be the reviewed release tag ${version} or v${version}`);

  const temporary = await mkdtemp(join(tmpdir(), 'bitcoinjs-release-compare-'));
  try {
    const local = join(temporary, 'local');
    const registry = join(temporary, 'registry');
    const { mkdir } = await import('node:fs/promises');
    await mkdir(local); await mkdir(registry);
    const pack = async (spec, destination) => {
      const response = JSON.parse(await command('npm', ['pack', spec, '--ignore-scripts', '--json', '--pack-destination', destination], { maxBytes: 5 * 1024 * 1024 }));
      if (response.length !== 1 || response[0].name !== 'bitcoinjs-lib' || response[0].version !== version) throw new Error('Unexpected npm pack metadata');
      return join(destination, response[0].filename);
    };
    const a = await pack('.', local);
    const b = await pack(`bitcoinjs-lib@${version}`, registry);
    return { ...await compareArchives(a, b), version, sourceCommit: await command('git', ['rev-parse', 'HEAD']) };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  try {
    const result = args[0] === '--compare' && args.length === 3 ? await compareArchives(args[1], args[2])
      : args.length === 1 ? await verifyPackage(args[0])
        : (() => { throw new Error('Usage: node tools/verify-npm-release.mjs <exact-version> OR --compare <source.tgz> <npm.tgz>'); })();
    console.log(JSON.stringify(result, null, 2));
    if (!result.matched) process.exitCode = 1;
  } catch (err) {
    console.error(`Package verification failed: ${err.message}`);
    process.exitCode = 2;
  }
}
