'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.checkTaprootInputForSigs =
  exports.tapTreeFromList =
  exports.tapTreeToList =
  exports.tweakInternalPubKey =
  exports.checkTaprootOutputFields =
  exports.checkTaprootInputFields =
  exports.isTaprootOutput =
  exports.isTaprootInput =
  exports.serializeTaprootSignature =
  exports.tapScriptFinalizer =
  exports.toXOnly =
    void 0;
const types_1 = require('../types');
const transaction_1 = require('../transaction');
const psbtutils_1 = require('./psbtutils');
const bip341_1 = require('../payments/bip341');
const payments_1 = require('../payments');
const psbtutils_2 = require('./psbtutils');
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
function isTaprootOutput(output, script) {
  return (
    output &&
    !!(
      output.tapInternalKey ||
      output.tapTree ||
      (output.tapBip32Derivation && output.tapBip32Derivation.length) ||
      (script && (0, psbtutils_1.isP2TR)(script))
    )
  );
}
exports.isTaprootOutput = isTaprootOutput;
function checkTaprootInputFields(inputData, newInputData, action) {
  checkMixedTaprootAndNonTaprootInputFields(inputData, newInputData, action);
  checkIfTapLeafInTree(inputData, newInputData, action);
}
exports.checkTaprootInputFields = checkTaprootInputFields;
function checkTaprootOutputFields(outputData, newOutputData, action) {
  checkMixedTaprootAndNonTaprootOutputFields(outputData, newOutputData, action);
  checkTaprootScriptPubkey(outputData, newOutputData);
}
exports.checkTaprootOutputFields = checkTaprootOutputFields;
function checkTaprootScriptPubkey(outputData, newOutputData) {
  if (!newOutputData.tapTree && !newOutputData.tapInternalKey) return;
  const tapInternalKey =
    newOutputData.tapInternalKey || outputData.tapInternalKey;
  const tapTree = newOutputData.tapTree || outputData.tapTree;
  if (tapInternalKey) {
    const { script: scriptPubkey } = outputData;
    const script = getTaprootScripPubkey(tapInternalKey, tapTree);
    if (scriptPubkey && !scriptPubkey.equals(script))
      throw new Error('Error adding output. Script or address missmatch.');
  }
}
function getTaprootScripPubkey(tapInternalKey, tapTree) {
  const scriptTree = tapTree && tapTreeFromList(tapTree.leaves);
  const { output } = (0, payments_1.p2tr)({
    internalPubkey: tapInternalKey,
    scriptTree,
  });
  return output;
}
function tweakInternalPubKey(inputIndex, input) {
  const tapInternalKey = input.tapInternalKey;
  const outputKey =
    tapInternalKey &&
    (0, bip341_1.tweakKey)(tapInternalKey, input.tapMerkleRoot);
  if (!outputKey)
    throw new Error(
      `Cannot tweak tap internal key for input #${inputIndex}. Public key: ${
        tapInternalKey && tapInternalKey.toString('hex')
      }`,
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
function checkTaprootInputForSigs(input, action) {
  const sigs = extractTaprootSigs(input);
  return sigs.some(sig =>
    (0, psbtutils_2.signatureBlocksAction)(sig, decodeSchnorrSignature, action),
  );
}
exports.checkTaprootInputForSigs = checkTaprootInputForSigs;
function decodeSchnorrSignature(signature) {
  return {
    signature: signature.slice(0, 64),
    hashType:
      signature.slice(64)[0] || transaction_1.Transaction.SIGHASH_DEFAULT,
  };
}
function extractTaprootSigs(input) {
  const sigs = [];
  if (input.tapKeySig) sigs.push(input.tapKeySig);
  if (input.tapScriptSig)
    sigs.push(...input.tapScriptSig.map(s => s.signature));
  if (!sigs.length) {
    const finalTapKeySig = getTapKeySigFromWithness(input.finalScriptWitness);
    if (finalTapKeySig) sigs.push(finalTapKeySig);
  }
  return sigs;
}
function getTapKeySigFromWithness(finalScriptWitness) {
  if (!finalScriptWitness) return;
  const witness = finalScriptWitness.slice(2);
  // todo: add schnorr signature validation
  if (witness.length === 64 || witness.length === 65) return witness;
}
function _tapTreeToList(tree, leaves = [], depth = 0) {
  if (depth > bip341_1.MAX_TAPTREE_DEPTH)
    throw new Error('Max taptree depth exceeded.');
  if (!tree) return [];
  if ((0, types_1.isTapleaf)(tree)) {
    leaves.push({
      depth,
      leafVersion: tree.version || bip341_1.LEAF_VERSION_TAPSCRIPT,
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
  if (depth > bip341_1.MAX_TAPTREE_DEPTH)
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
function checkMixedTaprootAndNonTaprootInputFields(
  inputData,
  newInputData,
  action,
) {
  const isBadTaprootUpdate =
    isTaprootInput(inputData) && hasNonTaprootFields(newInputData);
  const isBadNonTaprootUpdate =
    hasNonTaprootFields(inputData) && isTaprootInput(newInputData);
  const hasMixedFields =
    inputData === newInputData &&
    isTaprootInput(newInputData) &&
    hasNonTaprootFields(newInputData); // todo: bad? use !===
  if (isBadTaprootUpdate || isBadNonTaprootUpdate || hasMixedFields)
    throw new Error(
      `Invalid arguments for Psbt.${action}. ` +
        `Cannot use both taproot and non-taproot fields.`,
    );
}
function checkMixedTaprootAndNonTaprootOutputFields(
  inputData,
  newInputData,
  action,
) {
  const isBadTaprootUpdate =
    isTaprootOutput(inputData) && hasNonTaprootFields(newInputData);
  const isBadNonTaprootUpdate =
    hasNonTaprootFields(inputData) && isTaprootOutput(newInputData);
  const hasMixedFields =
    inputData === newInputData &&
    isTaprootOutput(newInputData) &&
    hasNonTaprootFields(newInputData);
  if (isBadTaprootUpdate || isBadNonTaprootUpdate || hasMixedFields)
    throw new Error(
      `Invalid arguments for Psbt.${action}. ` +
        `Cannot use both taproot and non-taproot fields.`,
    );
}
/**
 * Checks if the tap leaf is part of the tap tree for the given input data.
 * Throws an error if the tap leaf is not part of the tap tree.
 * @param inputData - The original PsbtInput data.
 * @param newInputData - The new PsbtInput data.
 * @param action - The action being performed.
 * @throws {Error} - If the tap leaf is not part of the tap tree.
 */
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
/**
 * Checks if a TapLeafScript is present in a Merkle tree.
 * @param tapLeaf The TapLeafScript to check.
 * @param merkleRoot The Merkle root of the tree. If not provided, the function assumes the TapLeafScript is present.
 * @returns A boolean indicating whether the TapLeafScript is present in the tree.
 */
function isTapLeafInTree(tapLeaf, merkleRoot) {
  if (!merkleRoot) return true;
  const leafHash = (0, bip341_1.tapleafHash)({
    output: tapLeaf.script,
    version: tapLeaf.leafVersion,
  });
  const rootHash = (0, bip341_1.rootHashFromPath)(
    tapLeaf.controlBlock,
    leafHash,
  );
  return rootHash.equals(merkleRoot);
}
/**
 * Sorts the signatures in the input's tapScriptSig array based on their position in the tapLeaf script.
 *
 * @param input - The PsbtInput object.
 * @param tapLeaf - The TapLeafScript object.
 * @returns An array of sorted signatures as Buffers.
 */
function sortSignatures(input, tapLeaf) {
  const leafHash = (0, bip341_1.tapleafHash)({
    output: tapLeaf.script,
    version: tapLeaf.leafVersion,
  });
  return (input.tapScriptSig || [])
    .filter(tss => tss.leafHash.equals(leafHash))
    .map(tss => addPubkeyPositionInScript(tapLeaf.script, tss))
    .sort((t1, t2) => t2.positionInScript - t1.positionInScript)
    .map(t => t.signature);
}
/**
 * Adds the position of a public key in a script to a TapScriptSig object.
 * @param script The script in which to find the position of the public key.
 * @param tss The TapScriptSig object to add the position to.
 * @returns A TapScriptSigWitPosition object with the added position.
 */
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
/**
 * Determines whether a TapLeafScript can be finalized.
 *
 * @param leaf - The TapLeafScript to check.
 * @param tapScriptSig - The array of TapScriptSig objects.
 * @param hash - The optional hash to compare with the leaf hash.
 * @returns A boolean indicating whether the TapLeafScript can be finalized.
 */
function canFinalizeLeaf(leaf, tapScriptSig, hash) {
  const leafHash = (0, bip341_1.tapleafHash)({
    output: leaf.script,
    version: leaf.leafVersion,
  });
  const whiteListedHash = !hash || hash.equals(leafHash);
  return (
    whiteListedHash &&
    tapScriptSig.find(tss => tss.leafHash.equals(leafHash)) !== undefined
  );
}
/**
 * Checks if the given PsbtInput or PsbtOutput has non-taproot fields.
 * Non-taproot fields include redeemScript, witnessScript, and bip32Derivation.
 * @param io The PsbtInput or PsbtOutput to check.
 * @returns A boolean indicating whether the given input or output has non-taproot fields.
 */
function hasNonTaprootFields(io) {
  return (
    io &&
    !!(
      io.redeemScript ||
      io.witnessScript ||
      (io.bip32Derivation && io.bip32Derivation.length)
    )
  );
}
