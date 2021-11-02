import { Buffer as NBuffer } from 'buffer';
const BN = require('bn.js');

import * as bcrypto from './crypto';
// todo: use varuint-bitcoin??
import * as varuint from 'bip174/src/lib/converter/varint';
import { TweakedPublicKey, ZERO32, EC_P, GROUP_ORDER } from './types';

// todo: !!!Temp, to be replaced. Only works because bip32 has it as dependecy. Linting will fail.
const ecc = require('tiny-secp256k1');

const LEAF_VERSION_TAPSCRIPT = 0xc0;
const TAP_LEAF_TAG = NBuffer.from('TapLeaf', 'utf8');
const TAP_BRANCH_TAG = NBuffer.from('TapBranch', 'utf8');
const TAP_TWEAK_TAG = NBuffer.from('TapTweak', 'utf8');

const EC_P_BN = new BN(EC_P);
const EC_P_REDUCTION = BN.red(EC_P_BN);
const EC_P_QUADRATIC_RESIDUE = EC_P_BN.addn(1).divn(4);
const BN_2 = new BN(2);
const BN_3 = new BN(3);
const BN_7 = new BN(7);

export function liftX(buffer: Buffer): Buffer | null {
  if (!NBuffer.isBuffer(buffer)) return null;
  if (buffer.length !== 32) return null;

  if (buffer.compare(ZERO32) === 0) return null;
  if (buffer.compare(EC_P) >= 0) return null;

  const x = new BN(buffer);

  const x1 = x.toRed(EC_P_REDUCTION);
  const ySq = x1
    .redPow(BN_3)
    .add(BN_7)
    .mod(EC_P_BN);

  const y = ySq.redPow(EC_P_QUADRATIC_RESIDUE);

  if (!ySq.eq(y.redPow(BN_2))) {
    return null;
  }
  const y1 = y.isEven() ? y : EC_P_BN.sub(y);

  return NBuffer.concat([
    NBuffer.from([0x04]),
    NBuffer.from(x1.toBuffer('be', 32)),
    NBuffer.from(y1.toBuffer('be', 32)),
  ]);
}

export function tweakKey(
  pubKey: Buffer,
  h: Buffer | undefined,
): TweakedPublicKey | null {
  if (!NBuffer.isBuffer(pubKey)) return null;
  if (pubKey.length !== 32) return null;
  if (h && h.length !== 32) return null;

  const tweakHash = bcrypto.taggedHash(
    TAP_TWEAK_TAG,
    NBuffer.concat(h ? [pubKey, h] : [pubKey]),
  );

  if (tweakHash.compare(GROUP_ORDER) >= 0) {
    // todo: add test for this case
    throw new Error('Tweak value over the SECP256K1 Order');
  }

  const P = liftX(pubKey);
  if (P === null) return null;

  const Q = pointAddScalar(P, tweakHash);
  return {
    isOdd: Q[64] % 2 === 1,
    x: Q.slice(1, 33),
  };
}

export function leafHash(script: Buffer, version: number): Buffer {
  return NBuffer.concat([NBuffer.from([version]), serializeScript(script)]);
}

export function rootHash(controlBlock: Buffer, tapLeafMsg: Buffer): Buffer {
  const k = [];
  const e = [];

  const m = (controlBlock.length - 33) / 32;
  k[0] = bcrypto.taggedHash(TAP_LEAF_TAG, tapLeafMsg);

  for (let j = 0; j < m; j++) {
    e[j] = controlBlock.slice(33 + 32 * j, 65 + 32 * j);
    if (k[j].compare(e[j]) < 0) {
      k[j + 1] = bcrypto.taggedHash(
        TAP_BRANCH_TAG,
        NBuffer.concat([k[j], e[j]]),
      );
    } else {
      k[j + 1] = bcrypto.taggedHash(
        TAP_BRANCH_TAG,
        NBuffer.concat([e[j], k[j]]),
      );
    }
  }

  return k[m];
}

// todo: solve any[]
export function computeMastRoot(scripts: any): Buffer {
  if (scripts.length === 1) {
    const script = scripts[0];
    if (Array.isArray(script)) {
      return computeMastRoot(script);
    }
    script.version = script.version || LEAF_VERSION_TAPSCRIPT;
    if ((script.version & 1) !== 0) throw new Error('Invalid script version'); // todo typedef error
    // todo: if (script.output)scheck is bytes
    const scriptOutput = NBuffer.from(script.output, 'hex');
    return bcrypto.taggedHash(
      TAP_LEAF_TAG,
      NBuffer.concat([
        NBuffer.from([script.version]),
        serializeScript(scriptOutput),
      ]),
    );
  }
  // todo: this is a binary tree, use zero an one index
  const half = Math.trunc(scripts.length / 2);
  let leftHash = computeMastRoot(scripts.slice(0, half));
  let rightHash = computeMastRoot(scripts.slice(half));

  if (leftHash.compare(rightHash) === 1)
    [leftHash, rightHash] = [rightHash, leftHash];
  return bcrypto.taggedHash(
    TAP_BRANCH_TAG,
    NBuffer.concat([leftHash, rightHash]),
  );
}

function serializeScript(s: Buffer): Buffer {
  const varintLen = varuint.encodingLength(s.length);
  const buffer = NBuffer.allocUnsafe(varintLen); // better
  varuint.encode(s.length, buffer);
  return NBuffer.concat([buffer, s]);
}

// todo: do not use ecc
function pointAddScalar(P: Buffer, h: Buffer): Buffer {
  return ecc.pointAddScalar(P, h);
}
