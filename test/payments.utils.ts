import * as t from 'assert';
import * as BNETWORKS from 'bitcoinjs-lib/src/networks';
import * as bscript from 'bitcoinjs-lib/src/script';
import * as tools from 'uint8array-tools';
import { isTaptree } from 'bitcoinjs-lib/src/types';

function tryHex(x: Uint8Array | Uint8Array[]): string | string[] {
  if (x instanceof Uint8Array) return tools.toHex(x);
  if (Array.isArray(x)) return x.map(tryHex) as string[];
  return x;
}

function fromHex(x: string | string[]): Uint8Array | Uint8Array[] {
  if (typeof x === 'string') return tools.fromHex(x);
  if (Array.isArray(x)) return x.map(fromHex) as Uint8Array[];
  return x;
}
function tryASM(x: Uint8Array): string {
  if (x instanceof Uint8Array) return bscript.toASM(x);
  return x;
}
function asmToBuffer(x: string): Uint8Array {
  if (x === '') return Buffer.alloc(0);
  return bscript.fromASM(x);
}
function carryOver(a: any, b: any): void {
  for (const k in b) {
    if (!k) continue;
    if (k in a && k === 'redeem') {
      carryOver(a[k], b[k]);
      continue;
    }

    // don't, the value was specified
    if (k in a) continue;

    // otherwise, expect match
    a[k] = b[k];
  }
}

function equateBase(a: any, b: any, context: string): void {
  if ('output' in b)
    t.strictEqual(
      tryASM(a.output),
      tryASM(b.output),
      `Inequal ${context}output`,
    );
  if ('input' in b)
    t.strictEqual(tryASM(a.input), tryASM(b.input), `Inequal ${context}input`);
  if ('witness' in b)
    t.deepStrictEqual(
      tryHex(a.witness),
      tryHex(b.witness),
      `Inequal ${context}witness`,
    );
  if ('redeemVersion' in b)
    t.strictEqual(
      a.redeemVersion,
      b.redeemVersion,
      `Inequal ${context}redeemVersion`,
    );
}

export function equate(a: any, b: any, args?: any): void {
  b = Object.assign({}, b);
  carryOver(b, args);

  // by null, we mean 'undefined', but JSON
  if (b.input === null) b.input = undefined;
  if (b.output === null) b.output = undefined;
  if (b.witness === null) b.witness = undefined;
  if (b.redeemVersion === null) b.redeemVersion = undefined;
  if (b.redeem) {
    if (b.redeem.input === null) b.redeem.input = undefined;
    if (b.redeem.output === null) b.redeem.output = undefined;
    if (b.redeem.witness === null) b.redeem.witness = undefined;
    if (b.redeem.redeemVersion === null) b.redeem.redeemVersion = undefined;
  }

  equateBase(a, b, '');
  if (b.redeem) equateBase(a.redeem, b.redeem, 'redeem.');
  if (b.network)
    t.deepStrictEqual(
      a.network,
      (BNETWORKS as any)[b.network],
      'Inequal *.network',
    );

  // contextual
  if (b.signature === null) b.signature = undefined;
  if (b.signatures === null) b.signatures = undefined;
  if ('address' in b) t.strictEqual(a.address, b.address, 'Inequal *.address');
  if ('name' in b) t.strictEqual(a.name, b.name, 'Inequal *.name');
  if ('hash' in b)
    t.strictEqual(tryHex(a.hash), tryHex(b.hash), 'Inequal *.hash');
  if ('pubkey' in b)
    t.strictEqual(tryHex(a.pubkey), tryHex(b.pubkey), 'Inequal *.pubkey');
  if ('internalPubkey' in b)
    t.strictEqual(
      tryHex(a.internalPubkey),
      tryHex(b.internalPubkey),
      'Inequal *.internalPubkey',
    );
  if ('signature' in b)
    t.strictEqual(
      tryHex(a.signature),
      tryHex(b.signature),
      'Inequal signature',
    );
  if ('m' in b) t.strictEqual(a.m, b.m, 'Inequal *.m');
  if ('n' in b) t.strictEqual(a.n, b.n, 'Inequal *.n');
  if ('pubkeys' in b)
    t.deepStrictEqual(
      tryHex(a.pubkeys),
      tryHex(b.pubkeys),
      'Inequal *.pubkeys',
    );
  if ('signatures' in b)
    t.deepStrictEqual(
      tryHex(a.signatures),
      tryHex(b.signatures),
      'Inequal *.signatures',
    );
  if ('data' in b)
    t.deepStrictEqual(tryHex(a.data), tryHex(b.data), 'Inequal *.data');
}

export function preform(x: any): any {
  x = Object.assign({}, x);

  if (x.network) x.network = (BNETWORKS as any)[x.network];
  if (typeof x.inputHex === 'string') {
    x.input = Buffer.from(x.inputHex, 'hex');
    delete x.inputHex;
  }
  if (typeof x.outputHex === 'string') {
    x.output = Buffer.from(x.outputHex, 'hex');
    delete x.outputHex;
  }
  if (typeof x.output === 'string') x.output = asmToBuffer(x.output);
  if (typeof x.input === 'string') x.input = asmToBuffer(x.input);
  if (Array.isArray(x.witness)) x.witness = x.witness.map(fromHex);

  if (x.data) x.data = x.data.map(fromHex);
  if (x.hash) x.hash = Buffer.from(x.hash, 'hex');
  if (x.pubkey) x.pubkey = Buffer.from(x.pubkey, 'hex');
  if (x.internalPubkey) x.internalPubkey = Buffer.from(x.internalPubkey, 'hex');
  if (x.signature) x.signature = Buffer.from(x.signature, 'hex');
  if (x.pubkeys) x.pubkeys = x.pubkeys.map(fromHex);
  if (x.signatures)
    x.signatures = x.signatures.map((y: any) => {
      return Number.isFinite(y) ? y : Buffer.from(y, 'hex');
    });
  if (x.redeem) {
    x.redeem = Object.assign({}, x.redeem);
    if (typeof x.redeem.input === 'string')
      x.redeem.input = asmToBuffer(x.redeem.input);
    if (typeof x.redeem.output === 'string')
      x.redeem.output = asmToBuffer(x.redeem.output);
    if (Array.isArray(x.redeem.witness))
      x.redeem.witness = x.redeem.witness.map(fromHex);
    if (x.redeem.network)
      x.redeem.network = (BNETWORKS as any)[x.redeem.network];
  }

  if (x.scriptTree) x.scriptTree = convertScriptTree(x.scriptTree);
  return x;
}

export function from(path: string, object: any, result?: any): any {
  const paths = path.split('.');
  result = result || {};

  let r = result;
  paths.forEach((k, i) => {
    if (i < paths.length - 1) {
      r[k] = r[k] || {};

      // recurse
      r = r[k];
      object = object[k];
    } else {
      r[k] = object[k];
    }
  });

  return result;
}

export function convertScriptTree(scriptTree: any, leafVersion?: number): any {
  if (Array.isArray(scriptTree))
    return scriptTree.map(tr => convertScriptTree(tr, leafVersion));

  const script = Object.assign({}, scriptTree);
  if (typeof script.output === 'string') {
    script.output = asmToBuffer(scriptTree.output);
    script.version = script.version || leafVersion;
  }
  return script;
}
