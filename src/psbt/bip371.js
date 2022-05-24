'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.tapTreeFromList = exports.tapTreeToList = exports.tweakInternalPubKey = exports.checkTaprootInputFields = exports.isTaprootInput = exports.serializeTaprootSignature = exports.tapScriptFinalizer = exports.toXOnly = void 0;
const types_1 = require('../types');
const psbtutils_1 = require('./psbtutils');
const taprootutils_1 = require('../payments/taprootutils');
const toXOnly = pubKey => (pubKey.length === 32 ? pubKey : pubKey.slice(1, 33));
exports.toXOnly = toXOnly;
/**
 * Default tapscript finalizer. It searches for the `tapLeafHashToFinalize` if provided.
 * Otherwise it will search for the tapleaf that has at least one signature and has the shortest path.
 * @param inputIndex the position of the PSBT input.
 * @param input the PSBT input.
 * @param tapLeafHashToFinalize optional, if provided the finalizer will search for a tapleaf that has this hash
 *                              and will try to build the finalScriptWitness.
 * @returns the finalScriptWitness or throws an exception if no tapleaf found.
 */
function tapScriptFinalizer(inputIndex, input, tapLeafHashToFinalize) {
  const tapLeaf = findTapLeafToFinalize(
    input,
    inputIndex,
    tapLeafHashToFinalize,
  );
  try {
    const sigs = sortSignatures(input, tapLeaf);
    const witness = sigs.concat(tapLeaf.script).concat(tapLeaf.controlBlock);
    return {
      finalScriptWitness: (0, psbtutils_1.witnessStackToScriptWitness)(witness),
    };
  } catch (err) {
    throw new Error(`Can not finalize taproot input #${inputIndex}: ${err}`);
  }
}
exports.tapScriptFinalizer = tapScriptFinalizer;
function serializeTaprootSignature(sig, sighashType) {
  const sighashTypeByte = sighashType
    ? Buffer.from([sighashType])
    : Buffer.from([]);
  return Buffer.concat([sig, sighashTypeByte]);
}
exports.serializeTaprootSignature = serializeTaprootSignature;
function isTaprootInput(input) {
  return (
    input &&
    !!(
      input.tapInternalKey ||
      input.tapMerkleRoot ||
      (input.tapLeafScript && input.tapLeafScript.length) ||
      (input.tapBip32Derivation && input.tapBip32Derivation.length) ||
      (input.witnessUtxo && (0, psbtutils_1.isP2TR)(input.witnessUtxo.script))
    )
  );
}
exports.isTaprootInput = isTaprootInput;
function checkTaprootInputFields(inputData, newInputData, action) {
  checkMixedTaprootAndNonTaprootFields(inputData, newInputData, action);
  checkIfTapLeafInTree(inputData, newInputData, action);
}
exports.checkTaprootInputFields = checkTaprootInputFields;
function tweakInternalPubKey(inputIndex, input) {
  const tapInternalKey = input.tapInternalKey;
  const outputKey =
    tapInternalKey &&
    (0, taprootutils_1.tweakKey)(tapInternalKey, input.tapMerkleRoot);
  if (!outputKey)
    throw new Error(
      `Cannot tweak tap internal key for input #${inputIndex}. Public key: ${tapInternalKey &&
        tapInternalKey.toString('hex')}`,
    );
  return outputKey.x;
}
exports.tweakInternalPubKey = tweakInternalPubKey;
/**
 * Convert a binary tree to a BIP371 type list. Each element of the list is (according to BIP371):
 * One or more tuples representing the depth, leaf version, and script for a leaf in the Taproot tree,
 * allowing the entire tree to be reconstructed. The tuples must be in depth first search order so that
 * the tree is correctly reconstructed.
 * @param tree the binary tap tree
 * @returns a list of BIP 371 tapleaves
 */
function tapTreeToList(tree) {
  if (!(0, types_1.isTaptree)(tree))
    throw new Error(
      'Cannot convert taptree to tapleaf list. Expecting a tapree structure.',
    );
  return _tapTreeToList(tree);
}
exports.tapTreeToList = tapTreeToList;
/**
 * Convert a BIP371 TapLeaf list to a TapTree (binary).
 * @param leaves a list of tapleaves where each element of the list is (according to BIP371):
 * One or more tuples representing the depth, leaf version, and script for a leaf in the Taproot tree,
 * allowing the entire tree to be reconstructed. The tuples must be in depth first search order so that
 * the tree is correctly reconstructed.
 * @returns the corresponding taptree, or throws an exception if the tree cannot be reconstructed
 */
function tapTreeFromList(leaves = []) {
  if (leaves.length === 1 && leaves[0].depth === 0)
    return {
      output: leaves[0].script,
      version: leaves[0].leafVersion,
    };
  return instertLeavesInTree(leaves);
}
exports.tapTreeFromList = tapTreeFromList;
function _tapTreeToList(tree, leaves = [], depth = 0) {
  if (depth > taprootutils_1.MAX_TAPTREE_DEPTH)
    throw new Error('Max taptree depth exceeded.');
  if (!tree) return [];
  if ((0, types_1.isTapleaf)(tree)) {
    leaves.push({
      depth,
      leafVersion: tree.version || taprootutils_1.LEAF_VERSION_TAPSCRIPT,
      script: tree.output,
    });
    return leaves;
  }
  if (tree[0]) _tapTreeToList(tree[0], leaves, depth + 1);
  if (tree[1]) _tapTreeToList(tree[1], leaves, depth + 1);
  return leaves;
}
function instertLeavesInTree(leaves) {
  let tree;
  for (const leaf of leaves) {
    tree = instertLeafInTree(leaf, tree);
    if (!tree) throw new Error(`No room left to insert tapleaf in tree`);
  }
  return tree;
}
function instertLeafInTree(leaf, tree, depth = 0) {
  if (depth > taprootutils_1.MAX_TAPTREE_DEPTH)
    throw new Error('Max taptree depth exceeded.');
  if (leaf.depth === depth) {
    if (!tree)
      return {
        output: leaf.script,
        version: leaf.leafVersion,
      };
    return;
  }
  if ((0, types_1.isTapleaf)(tree)) return;
  const leftSide = instertLeafInTree(leaf, tree && tree[0], depth + 1);
  if (leftSide) return [leftSide, tree && tree[1]];
  const rightSide = instertLeafInTree(leaf, tree && tree[1], depth + 1);
  if (rightSide) return [tree && tree[0], rightSide];
}
function checkMixedTaprootAndNonTaprootFields(inputData, newInputData, action) {
  const isBadTaprootUpdate =
    isTaprootInput(inputData) && hasNonTaprootInputFields(newInputData);
  const isBadNonTaprootUpdate =
    hasNonTaprootInputFields(inputData) && isTaprootInput(newInputData);
  const hasMixedFields =
    inputData === newInputData &&
    (isTaprootInput(newInputData) && hasNonTaprootInputFields(newInputData));
  if (isBadTaprootUpdate || isBadNonTaprootUpdate || hasMixedFields)
    throw new Error(
      `Invalid arguments for Psbt.${action}. ` +
        `Cannot use both taproot and non-taproot fields.`,
    );
}
function checkIfTapLeafInTree(inputData, newInputData, action) {
  if (newInputData.tapMerkleRoot) {
    const newLeafsInTree = (newInputData.tapLeafScript || []).every(l =>
      isTapLeafInTree(l, newInputData.tapMerkleRoot),
    );
    const oldLeafsInTree = (inputData.tapLeafScript || []).every(l =>
      isTapLeafInTree(l, newInputData.tapMerkleRoot),
    );
    if (!newLeafsInTree || !oldLeafsInTree)
      throw new Error(
        `Invalid arguments for Psbt.${action}. Tapleaf not part of taptree.`,
      );
  } else if (inputData.tapMerkleRoot) {
    const newLeafsInTree = (newInputData.tapLeafScript || []).every(l =>
      isTapLeafInTree(l, inputData.tapMerkleRoot),
    );
    if (!newLeafsInTree)
      throw new Error(
        `Invalid arguments for Psbt.${action}. Tapleaf not part of taptree.`,
      );
  }
}
function isTapLeafInTree(tapLeaf, merkleRoot) {
  if (!merkleRoot) return true;
  const leafHash = (0, taprootutils_1.tapleafHash)({
    output: tapLeaf.script,
    version: tapLeaf.leafVersion,
  });
  const rootHash = (0, taprootutils_1.rootHashFromPath)(
    tapLeaf.controlBlock,
    leafHash,
  );
  return rootHash.equals(merkleRoot);
}
function sortSignatures(input, tapLeaf) {
  const leafHash = (0, taprootutils_1.tapleafHash)({
    output: tapLeaf.script,
    version: tapLeaf.leafVersion,
  });
  return (input.tapScriptSig || [])
    .filter(tss => tss.leafHash.equals(leafHash))
    .map(tss => addPubkeyPositionInScript(tapLeaf.script, tss))
    .sort((t1, t2) => t2.positionInScript - t1.positionInScript)
    .map(t => t.signature);
}
function addPubkeyPositionInScript(script, tss) {
  return Object.assign(
    {
      positionInScript: (0, psbtutils_1.pubkeyPositionInScript)(
        tss.pubkey,
        script,
      ),
    },
    tss,
  );
}
/**
 * Find tapleaf by hash, or get the signed tapleaf with the shortest path.
 */
function findTapLeafToFinalize(input, inputIndex, leafHashToFinalize) {
  if (!input.tapScriptSig || !input.tapScriptSig.length)
    throw new Error(
      `Can not finalize taproot input #${inputIndex}. No tapleaf script signature provided.`,
    );
  const tapLeaf = (input.tapLeafScript || [])
    .sort((a, b) => a.controlBlock.length - b.controlBlock.length)
    .find(leaf =>
      canFinalizeLeaf(leaf, input.tapScriptSig, leafHashToFinalize),
    );
  if (!tapLeaf)
    throw new Error(
      `Can not finalize taproot input #${inputIndex}. Signature for tapleaf script not found.`,
    );
  return tapLeaf;
}
function canFinalizeLeaf(leaf, tapScriptSig, hash) {
  const leafHash = (0, taprootutils_1.tapleafHash)({
    output: leaf.script,
    version: leaf.leafVersion,
  });
  const whiteListedHash = !hash || hash.equals(leafHash);
  return (
    whiteListedHash &&
    tapScriptSig.find(tss => tss.leafHash.equals(leafHash)) !== undefined
  );
}
function hasNonTaprootInputFields(input) {
  return (
    input &&
    !!(
      input.redeemScript ||
      input.witnessScript ||
      (input.bip32Derivation && input.bip32Derivation.length)
    )
  );
}
