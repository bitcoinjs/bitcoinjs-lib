'use strict';
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null)
      for (var k in mod)
        if (k !== 'default' && Object.prototype.hasOwnProperty.call(mod, k))
          __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.MAX_TAPTREE_DEPTH = exports.LEAF_VERSION_TAPSCRIPT = void 0;
exports.rootHashFromPath = rootHashFromPath;
exports.toHashTree = toHashTree;
exports.findScriptPath = findScriptPath;
exports.tapleafHash = tapleafHash;
exports.tapTweakHash = tapTweakHash;
exports.tweakKey = tweakKey;
const ecc_lib_js_1 = require('../ecc_lib.cjs');
const bcrypto = __importStar(require('../crypto.cjs'));
const bufferutils_js_1 = require('../bufferutils.cjs');
const types_js_1 = require('../types.cjs');
const tools = __importStar(require('uint8array-tools'));
exports.LEAF_VERSION_TAPSCRIPT = 0xc0;
exports.MAX_TAPTREE_DEPTH = 128;
const isHashBranch = ht => 'left' in ht && 'right' in ht;
/**
 * Calculates the root hash from a given control block and leaf hash.
 * @param controlBlock - The control block buffer.
 * @param leafHash - The leaf hash buffer.
 * @returns The root hash buffer.
 * @throws {TypeError} If the control block length is less than 33.
 */
function rootHashFromPath(controlBlock, leafHash) {
  if (controlBlock.length < 33)
    throw new TypeError(
      `The control-block length is too small. Got ${controlBlock.length}, expected min 33.`,
    );
  const m = (controlBlock.length - 33) / 32;
  let kj = leafHash;
  for (let j = 0; j < m; j++) {
    const ej = controlBlock.slice(33 + 32 * j, 65 + 32 * j);
    if (tools.compare(kj, ej) < 0) {
      kj = tapBranchHash(kj, ej);
    } else {
      kj = tapBranchHash(ej, kj);
    }
  }
  return kj;
}
/**
 * Build a hash tree of merkle nodes from the scripts binary tree.
 * @param scriptTree - the tree of scripts to pairwise hash.
 */
function toHashTree(scriptTree) {
  if ((0, types_js_1.isTapleaf)(scriptTree))
    return { hash: tapleafHash(scriptTree) };
  const hashes = [toHashTree(scriptTree[0]), toHashTree(scriptTree[1])];
  // hashes.sort((a, b) => a.hash.compare(b.hash));
  hashes.sort((a, b) => tools.compare(a.hash, b.hash));
  const [left, right] = hashes;
  return {
    hash: tapBranchHash(left.hash, right.hash),
    left,
    right,
  };
}
/**
 * Given a HashTree, finds the path from a particular hash to the root.
 * @param node - the root of the tree
 * @param hash - the hash to search for
 * @returns - array of sibling hashes, from leaf (inclusive) to root
 * (exclusive) needed to prove inclusion of the specified hash. undefined if no
 * path is found
 */
function findScriptPath(node, hash) {
  if (isHashBranch(node)) {
    const leftPath = findScriptPath(node.left, hash);
    if (leftPath !== undefined) return [...leftPath, node.right.hash];
    const rightPath = findScriptPath(node.right, hash);
    if (rightPath !== undefined) return [...rightPath, node.left.hash];
  } else if (tools.compare(node.hash, hash) === 0) {
    return [];
  }
  return undefined;
}
/**
 * Calculates the tapleaf hash for a given Tapleaf object.
 * @param leaf - The Tapleaf object to calculate the hash for.
 * @returns The tapleaf hash as a Buffer.
 */
function tapleafHash(leaf) {
  const version = leaf.version || exports.LEAF_VERSION_TAPSCRIPT;
  return bcrypto.taggedHash(
    'TapLeaf',
    tools.concat([Uint8Array.from([version]), serializeScript(leaf.output)]),
  );
}
/**
 * Computes the taproot tweak hash for a given public key and optional hash.
 * If a hash is provided, the public key and hash are concatenated before computing the hash.
 * If no hash is provided, only the public key is used to compute the hash.
 *
 * @param pubKey - The public key buffer.
 * @param h - The optional hash buffer.
 * @returns The taproot tweak hash.
 */
function tapTweakHash(pubKey, h) {
  return bcrypto.taggedHash(
    'TapTweak',
    tools.concat(h ? [pubKey, h] : [pubKey]),
  );
}
/**
 * Tweak a public key with a given tweak hash.
 * @param pubKey - The public key to be tweaked.
 * @param h - The tweak hash.
 * @returns The tweaked public key or null if the input is invalid.
 */
function tweakKey(pubKey, h) {
  if (!(pubKey instanceof Uint8Array)) return null;
  if (pubKey.length !== 32) return null;
  if (h && h.length !== 32) return null;
  const tweakHash = tapTweakHash(pubKey, h);
  const res = (0, ecc_lib_js_1.getEccLib)().xOnlyPointAddTweak(
    pubKey,
    tweakHash,
  );
  if (!res || res.xOnlyPubkey === null) return null;
  return {
    parity: res.parity,
    x: Uint8Array.from(res.xOnlyPubkey),
  };
}
/**
 * Computes the TapBranch hash by concatenating two buffers and applying the 'TapBranch' tagged hash algorithm.
 *
 * @param a - The first buffer.
 * @param b - The second buffer.
 * @returns The TapBranch hash of the concatenated buffers.
 */
function tapBranchHash(a, b) {
  return bcrypto.taggedHash('TapBranch', tools.concat([a, b]));
}
/**
 * Serializes a script by encoding its length as a varint and concatenating it with the script.
 *
 * @param s - The script to be serialized.
 * @returns The serialized script as a Buffer.
 */
function serializeScript(s) {
  /* global BigInt */
  const varintLen = bufferutils_js_1.varuint.encodingLength(s.length);
  const buffer = new Uint8Array(varintLen);
  bufferutils_js_1.varuint.encode(s.length, buffer);
  return tools.concat([buffer, s]);
}
