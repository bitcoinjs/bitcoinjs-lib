// Taproot-specific key aggregation and taptree logic as defined in:
// https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki
// https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki

import assert = require('assert');
import FastPriorityQueue = require('fastpriorityqueue');
import * as bcrypto from './crypto';
const varuint = require('varuint-bitcoin');

const ecc = require('tiny-secp256k1');

/**
 * The 0x02 prefix indicating an even Y coordinate which is implicitly assumed
 * on all 32 byte x-only pub keys as defined in BIP340.
 */
export const EVEN_Y_COORD_PREFIX = new Uint8Array([0x02]);
const INITIAL_TAPSCRIPT_VERSION = new Uint8Array([0xc0]);

const TAGS = [
  'TapLeaf',
  'TapBranch',
  'TapTweak',
  'KeyAgg list',
  'KeyAgg coefficient',
] as const;
type TaggedHashPrefix = typeof TAGS[number];
/** An object mapping tags to their tagged hash prefix of [SHA256(tag) | SHA256(tag)] */
const TAGGED_HASH_PREFIXES = Object.fromEntries(
  TAGS.map(tag => {
    const tagHash = bcrypto.sha256(Buffer.from(tag));
    return [tag, Buffer.concat([tagHash, tagHash])];
  }),
) as { [k in TaggedHashPrefix]: Buffer };

function taggedHash(prefix: TaggedHashPrefix, data: Buffer): Buffer {
  return bcrypto.sha256(Buffer.concat([TAGGED_HASH_PREFIXES[prefix], data]));
}

/**
 * Aggregates a list of public keys into a single MuSig2* public key
 * according to the MuSig2 paper.
 * @param pubkeys The list of pub keys to aggregate
 * @returns a 32 byte Buffer representing the aggregate key
 */
export function aggregateMuSigPubkeys(pubkeys: Buffer[]): Buffer {
  // TODO: Consider enforcing key uniqueness.
  assert(
    pubkeys.length > 1,
    'at least two pubkeys are required for musig key aggregation',
  );

  // Trim the 0x02/0x03 leading byte from each key and sort in ascending order
  // to convert to 32 byte x-coordinates with implicit even Y coordinates.
  pubkeys.sort(Buffer.compare);

  // In MuSig all signers contribute key material to a single signing key,
  // using the equation
  //
  //     P = sum_i µ_i * P_i
  //
  // where `P_i` is the public key of the `i`th signer and `µ_i` is a so-called
  // _MuSig coefficient_ computed according to the following equation
  //
  // L = H(P_1 || P_2 || ... || P_n)
  // µ_i = H(L || P_i)

  const L = taggedHash('KeyAgg list', Buffer.concat(pubkeys));

  const tweakedPubkeys: Buffer[] = pubkeys.map((pubkey, index) => {
    const xyPubkey = Buffer.concat([EVEN_Y_COORD_PREFIX, pubkey]);

    if (index === 1) {
      // The second unique key in the pubkey list gets the constant KeyAgg
      // coefficient 1 which saves an exponentiation. See the MuSig2*
      // appendix in the MuSig2 paper for details.
      return xyPubkey;
    }

    const c = taggedHash('KeyAgg coefficient', Buffer.concat([L, pubkey]));

    return ecc.pointMultiply(xyPubkey, c);
  });
  const aggregatePubkey = tweakedPubkeys.reduce((prev, curr) =>
    ecc.pointAdd(prev, curr),
  );

  return aggregatePubkey.slice(1);
}

/**
 * Encodes the length of a script as a bitcoin variable length integer.
 * @param script
 * @returns
 */
export function serializeScriptSize(script: Buffer): Buffer {
  return varuint.encode(script.length);
}

/**
 * Gets a tapleaf tagged hash from a script.
 * @param script
 * @returns
 */
export function hashTapLeaf(script: Buffer): Buffer {
  const size = serializeScriptSize(script);
  return taggedHash(
    'TapLeaf',
    Buffer.concat([INITIAL_TAPSCRIPT_VERSION, size, script]),
  );
}

/**
 * Creates a lexicographically sorted tapbranch from two child taptree nodes
 * and returns its tagged hash.
 * @param child1
 * @param child2
 * @returns the tagged tapbranch hash
 */
export function hashTapBranch(child1: Buffer, child2: Buffer): Buffer {
  // sort the children lexicographically
  const sortedChildren = [child1, child2].sort(Buffer.compare);

  return taggedHash('TapBranch', Buffer.concat(sortedChildren));
}

export interface TweakedPubkey {
  parity: 0 | 1;
  pubkey: Buffer;
}

/**
 * Tweaks an internal pubkey using the tagged hash of a taptree root.
 * @param pubkey the internal pubkey to tweak
 * @param tapTreeRoot the taptree root tagged hash
 * @returns the tweaked pubkey
 */
export function tapTweakPubkey(
  pubkey: Buffer,
  tapTreeRoot?: Buffer,
): TweakedPubkey {
  let tapTweak: Buffer;
  if (tapTreeRoot) {
    tapTweak = taggedHash('TapTweak', Buffer.concat([pubkey, tapTreeRoot]));
  } else {
    // If the spending conditions do not require a script path, the output key should commit to an
    // unspendable script path instead of having no script path.
    // https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki#cite_note-22
    tapTweak = taggedHash('TapTweak', pubkey);
  }

  const tweakedPubkey = ecc.pointAddScalar(
    Buffer.concat([EVEN_Y_COORD_PREFIX, pubkey]),
    tapTweak,
  );
  return {
    parity: tweakedPubkey[0] === EVEN_Y_COORD_PREFIX[0] ? 0 : 1,
    pubkey: tweakedPubkey.slice(1),
  };
}

export interface Taptree {
  root: Buffer;
  paths: Buffer[][];
}

interface WeightedTapScript {
  /** A TapLeaf or TapBranch tagged hash */
  taggedHash: Buffer;
  weight: number;
  paths: {
    [index: number]: Buffer[];
  };
}

/**
 * Gets the root hash of a taptree using a weighted Huffman construction from a
 * list of scripts and corresponding weights.
 * @param scripts
 * @param weights
 * @returns the tagged hash of the taptree root
 */
export function getHuffmanTaptree(
  scripts: Buffer[],
  weights: Array<number | undefined>,
): Taptree {
  assert(
    scripts.length > 0,
    'at least one script is required to construct a tap tree',
  );

  // Create a queue/heap of the provided scripts prioritized according to their
  // corresponding weights.
  const queue = new FastPriorityQueue<WeightedTapScript>(
    (a, b): boolean => {
      return a.weight < b.weight;
    },
  );
  scripts.forEach((script, index) => {
    const weight = weights[index] || 1;
    assert(weight > 0, 'script weight must be a positive value');

    queue.add({
      weight,
      taggedHash: hashTapLeaf(script),
      paths: { [index]: [] },
    });
  });

  // Now that we have a queue of weighted scripts, we begin a loop whereby we
  // remove the two lowest weighted items from the queue. We create a tap branch
  // node from the two items, and add the branch back to the queue with the
  // combined weight of both its children. Each loop reduces the number of items
  // in the queue by one, and we repeat until we are left with only one item -
  // this becomes the tap tree root.
  //
  // For example, if we begin with scripts A, B, C, D with weights 6, 3, 1, 1
  // After first loop: A(6), B(3), CD(1 + 1)
  // After second loop: A(6), B[CD](3 + 2)
  // Final loop: A[B[CD]](6+5)
  // The final tree will look like:
  //
  //        A[B[CD]]
  //       /        \
  //      A         B[CD]
  //               /     \
  //              B      [CD]
  //                    /    \
  //                   C      D
  //
  // This ensures that the spending conditions we believe to have the highest
  // probability of being used are further up the tree than less likely scripts,
  // thereby reducing the size of the merkle proofs for the more likely scripts.
  while (queue.size > 1) {
    // We can safely expect two polls to return non-null elements since we've
    // checked that the queue has at least two elements before looping.
    const child1 = queue.poll()!;
    const child2 = queue.poll()!;

    Object.values(child1.paths).forEach(path => path.push(child2.taggedHash));
    Object.values(child2.paths).forEach(path => path.push(child1.taggedHash));

    queue.add({
      taggedHash: hashTapBranch(child1.taggedHash, child2.taggedHash),
      weight: child1.weight + child2.weight,
      paths: { ...child1.paths, ...child2.paths },
    });
  }

  // After the while loop above completes we should have exactly one element
  // remaining in the queue, which we can safely extract below.
  const rootNode = queue.poll()!;

  const paths = Object.entries(rootNode.paths).reduce((acc, [index, path]) => {
    acc[Number(index)] = path; // TODO: Why doesn't TS know it's a number?
    return acc;
  }, Array(scripts.length));
  return { root: rootNode.taggedHash, paths };
}

export function getControlBlock(
  parity: 0 | 1,
  pubkey: Buffer,
  path: Buffer[],
): Buffer {
  const parityVersion = INITIAL_TAPSCRIPT_VERSION[0] + parity;

  return Buffer.concat([new Uint8Array([parityVersion]), pubkey, ...path]);
}
