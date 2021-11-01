import { Buffer as NBuffer } from 'buffer';
import * as bcrypto from './crypto';
// todo: use varuint-bitcoin??
import * as varuint from 'bip174/src/lib/converter/varint';


const TAP_LEAF_TAG = NBuffer.from('TapLeaf', 'utf8');
const TAP_BRANCH_TAG = NBuffer.from('TapBranch', 'utf8');
const LEAF_VERSION_TAPSCRIPT = 0xc0


export function fastMerkleRoot(
  values: Buffer[],
  digestFn: (b: Buffer) => Buffer,
): Buffer {
  if (!Array.isArray(values)) throw TypeError('Expected values Array');
  if (typeof digestFn !== 'function')
    throw TypeError('Expected digest Function');

  let length = values.length;
  const results = values.concat();

  while (length > 1) {
    let j = 0;

    for (let i = 0; i < length; i += 2, ++j) {
      const left = results[i];
      const right = i + 1 === length ? left : results[i + 1];
      const data = Buffer.concat([left, right]);

      results[j] = digestFn(data);
    }

    length = j;
  }

  return results[0];
}

// todo: solve any[]
export function computeMastRoot(scripts: any): Buffer {
  if (scripts.length === 1) {
      const script = scripts[0]
      if (Array.isArray(script)) {
          return computeMastRoot(script)
      }
      script.version = script.version || LEAF_VERSION_TAPSCRIPT
      if ((script.version & 1) !== 0) throw new Error("Invalid script version") // todo typedef error
      // todo: if (script.output)scheck is bytes
      const scriptOutput = NBuffer.from(script.output, 'hex')
      return bcrypto.taggedHash(TAP_LEAF_TAG, NBuffer.concat([NBuffer.from([script.version]), serializeScript(scriptOutput)]))
  }
  // todo: this is a binary tree, use zero an one index
  const half = Math.trunc(scripts.length / 2)
  let leftHash = computeMastRoot(scripts.slice(0, half))
  let rightHash = computeMastRoot(scripts.slice(half))

  if (leftHash.compare(rightHash) === 1) [leftHash, rightHash] = [rightHash, leftHash]
  return bcrypto.taggedHash(TAP_BRANCH_TAG, NBuffer.concat([leftHash, rightHash]))
}

function serializeScript(s: Buffer) {
  const varintLen = varuint.encodingLength(s.length);
  const buffer = NBuffer.allocUnsafe(varintLen); // better
  varuint.encode(s.length, buffer);
  return NBuffer.concat([buffer, s])
}