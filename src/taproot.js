'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const assert = require('assert');
const FastPriorityQueue = require('fastpriorityqueue');
const bcrypto = require('./crypto');
const ecc = require('tiny-secp256k1');
// const SECP256K1_ORDER = Buffer.from('fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141', 'hex')
const INITIAL_TAPSCRIPT_VERSION = Buffer.from('c0', 'hex');
const TAPLEAF_TAGGED_HASH = bcrypto.sha256(Buffer.from('TapLeaf'));
const TAPBRANCH_TAGGED_HASH = bcrypto.sha256(Buffer.from('TapBranch'));
const TAPTWEAK_TAGGED_HASH = bcrypto.sha256(Buffer.from('TapTweak'));
/**
 * Trims the leading 02/03 byte from an ECDSA pub key to get a 32 byte schnorr
 * pub key with x-only coordinates.
 * @param pubkey A 33 byte pubkey representing an EC point
 * @returns a 32 byte x-only coordinate
 */
function trimFirstByte(pubkey) {
  assert(pubkey.length === 33);
  return pubkey.slice(1, 33);
}
exports.trimFirstByte = trimFirstByte;
/**
 * Aggregates a list of public keys into a single MuSig public key
 * according to the MuSig paper.
 * @param pubkeys The list of pub keys to aggregate
 * @returns a 32 byte Buffer representing the aggregate key
 */
function aggregateMuSigPubkeys(pubkeys) {
  // sort keys in ascending order
  pubkeys.sort();
  const trimmedPubkeys = [];
  pubkeys.forEach(pubkey => {
    const trimmedPubkey = trimFirstByte(pubkey);
    trimmedPubkeys.push(trimmedPubkey);
  });
  // In MuSig all signers contribute key material to a single signing key,
  // using the equation
  //
  //     P = sum_i µ_i * P_i
  //
  // where `P_i` is the public key of the `i`th signer and `µ_i` is a so-called
  // _MuSig coefficient_ computed according to the following equation
  //
  // L = H(P_1 || P_2 || ... || P_n)
  // µ_i = H(L || i)
  const L = bcrypto.sha256(Buffer.concat(trimmedPubkeys));
  let aggregatePubkey;
  pubkeys.forEach(pubkey => {
    const trimmedPubkey = trimFirstByte(pubkey);
    const c = bcrypto.sha256(Buffer.concat([L, trimmedPubkey]));
    const tweakedPubkey = ecc.pointMultiply(pubkey, c);
    if (aggregatePubkey === undefined) {
      aggregatePubkey = tweakedPubkey;
    } else {
      aggregatePubkey = ecc.pointAdd(aggregatePubkey, tweakedPubkey);
    }
  });
  return aggregatePubkey;
}
exports.aggregateMuSigPubkeys = aggregateMuSigPubkeys;
/**
 * Gets a tapleaf tagged hash from a script.
 * @param script
 * @returns
 */
function hashTapLeaf(script) {
  // TODO: use multiple byte `size` when script length is >= 253 bytes
  const size = new Uint8Array([script.length]);
  return bcrypto.sha256(
    Buffer.concat([
      TAPLEAF_TAGGED_HASH,
      TAPLEAF_TAGGED_HASH,
      INITIAL_TAPSCRIPT_VERSION,
      size,
      script,
    ]),
  );
}
exports.hashTapLeaf = hashTapLeaf;
/**
 * Creates a lexicographically sorted tapbranch from two child taptree nodes
 * and returns its tagged hash.
 * @param child1
 * @param child2
 * @returns the tagged tapbranch hash
 */
function hashTapBranch(child1, child2) {
  let leftChild;
  let rightChild;
  // sort the children lexicographically
  if (child1 < child2) {
    leftChild = child1;
    rightChild = child2;
  } else {
    leftChild = child2;
    rightChild = child1;
  }
  return bcrypto.sha256(
    Buffer.concat([
      TAPBRANCH_TAGGED_HASH,
      TAPBRANCH_TAGGED_HASH,
      leftChild,
      rightChild,
    ]),
  );
}
exports.hashTapBranch = hashTapBranch;
/**
 * Tweaks an internal pubkey using the tagged hash of a taptree root.
 * @param pubkey the internal pubkey to tweak
 * @param tapTreeRoot the taptree root tagged hash
 * @returns the tweaked pubkey
 */
function tapTweakPubkey(pubkey, tapTreeRoot) {
  let tweakedPubkey;
  if (tapTreeRoot) {
    const trimmedPubkey = trimFirstByte(pubkey);
    const tapTweak = bcrypto.sha256(
      Buffer.concat([
        TAPTWEAK_TAGGED_HASH,
        TAPTWEAK_TAGGED_HASH,
        trimmedPubkey,
        tapTreeRoot,
      ]),
    );
    tweakedPubkey = ecc.pointAddScalar(pubkey, tapTweak);
  } else {
    // If the spending conditions do not require a script path, the output key should commit to an
    // unspendable script path instead of having no script path.
    const unspendableScriptPathRoot = bcrypto.sha256(pubkey);
    tweakedPubkey = ecc.pointAddScalar(pubkey, unspendableScriptPathRoot);
  }
  return trimFirstByte(tweakedPubkey);
}
exports.tapTweakPubkey = tapTweakPubkey;
/**
 * Gets the root hash of a taptree using a weighted Huffman construction from a
 * list of scripts and corresponding weights,
 * @param scripts
 * @param weights
 * @returns the tagged hash of the taptree root
 */
function getHuffmanTaptreeRoot(scripts, weights) {
  const weightedScripts = [];
  scripts.forEach((script, index) => {
    const weight = weights ? weights[index] || 1 : 1;
    assert(weight > 0);
    assert(Number.isInteger(weight));
    weightedScripts.push({
      weight,
      taggedHash: hashTapLeaf(script),
    });
  });
  const queue = new FastPriorityQueue((a, b) => {
    return a.weight < b.weight;
  });
  weightedScripts.forEach(weightedScript => {
    queue.add(weightedScript);
  });
  while (queue.size > 1) {
    const child1 = queue.poll();
    const child2 = queue.poll();
    const branchHash = hashTapBranch(child1.taggedHash, child2.taggedHash);
    queue.add({
      taggedHash: branchHash,
      weight: child1.weight + child2.weight,
    });
  }
  const tapTreeHash = queue.poll().taggedHash;
  return tapTreeHash;
}
exports.getHuffmanTaptreeRoot = getHuffmanTaptreeRoot;
