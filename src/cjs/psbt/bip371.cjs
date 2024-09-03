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
exports.toXOnly = void 0;
exports.tapScriptFinalizer = tapScriptFinalizer;
exports.serializeTaprootSignature = serializeTaprootSignature;
exports.isTaprootInput = isTaprootInput;
exports.isTaprootOutput = isTaprootOutput;
exports.checkTaprootInputFields = checkTaprootInputFields;
exports.checkTaprootOutputFields = checkTaprootOutputFields;
exports.tweakInternalPubKey = tweakInternalPubKey;
exports.tapTreeToList = tapTreeToList;
exports.tapTreeFromList = tapTreeFromList;
exports.checkTaprootInputForSigs = checkTaprootInputForSigs;
const types_js_1 = require('../types.cjs');
const transaction_js_1 = require('../transaction.cjs');
const psbtutils_js_1 = require('./psbtutils.cjs');
const bip341_js_1 = require('../payments/bip341.cjs');
const index_js_1 = require('../payments/index.cjs');
const tools = __importStar(require('uint8array-tools'));
const psbtutils_js_2 = require('./psbtutils.cjs');
/**
 * Converts a public key to an X-only public key.
 * @param pubKey The public key to convert.
 * @returns The X-only public key.
 */
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
      finalScriptWitness: (0, psbtutils_js_1.witnessStackToScriptWitness)(
        witness,
      ),
    };
  } catch (err) {
    throw new Error(`Can not finalize taproot input #${inputIndex}: ${err}`);
  }
}
/**
 * Serializes a taproot signature.
 * @param sig The signature to serialize.
 * @param sighashType The sighash type. Optional.
 * @returns The serialized taproot signature.
 */
function serializeTaprootSignature(sig, sighashType) {
  const sighashTypeByte = sighashType
    ? Uint8Array.from([sighashType])
    : Uint8Array.from([]);
  return tools.concat([sig, sighashTypeByte]);
}
/**
 * Checks if a PSBT input is a taproot input.
 * @param input The PSBT input to check.
 * @returns True if the input is a taproot input, false otherwise.
 */
function isTaprootInput(input) {
  return (
    input &&
    !!(
      input.tapInternalKey ||
      input.tapMerkleRoot ||
      (input.tapLeafScript && input.tapLeafScript.length) ||
      (input.tapBip32Derivation && input.tapBip32Derivation.length) ||
      (input.witnessUtxo &&
        (0, psbtutils_js_1.isP2TR)(input.witnessUtxo.script))
    )
  );
}
/**
 * Checks if a PSBT output is a taproot output.
 * @param output The PSBT output to check.
 * @param script The script to check. Optional.
 * @returns True if the output is a taproot output, false otherwise.
 */
function isTaprootOutput(output, script) {
  return (
    output &&
    !!(
      output.tapInternalKey ||
      output.tapTree ||
      (output.tapBip32Derivation && output.tapBip32Derivation.length) ||
      (script && (0, psbtutils_js_1.isP2TR)(script))
    )
  );
}
/**
 * Checks the taproot input fields for consistency.
 * @param inputData The original input data.
 * @param newInputData The new input data.
 * @param action The action being performed.
 * @throws Throws an error if the input fields are inconsistent.
 */
function checkTaprootInputFields(inputData, newInputData, action) {
  checkMixedTaprootAndNonTaprootInputFields(inputData, newInputData, action);
  checkIfTapLeafInTree(inputData, newInputData, action);
}
/**
 * Checks the taproot output fields for consistency.
 * @param outputData The original output data.
 * @param newOutputData The new output data.
 * @param action The action being performed.
 * @throws Throws an error if the output fields are inconsistent.
 */
function checkTaprootOutputFields(outputData, newOutputData, action) {
  checkMixedTaprootAndNonTaprootOutputFields(outputData, newOutputData, action);
  checkTaprootScriptPubkey(outputData, newOutputData);
}
function checkTaprootScriptPubkey(outputData, newOutputData) {
  if (!newOutputData.tapTree && !newOutputData.tapInternalKey) return;
  const tapInternalKey =
    newOutputData.tapInternalKey || outputData.tapInternalKey;
  const tapTree = newOutputData.tapTree || outputData.tapTree;
  if (tapInternalKey) {
    const { script: scriptPubkey } = outputData;
    const script = getTaprootScripPubkey(tapInternalKey, tapTree);
    if (scriptPubkey && tools.compare(script, scriptPubkey) !== 0)
      throw new Error('Error adding output. Script or address mismatch.');
  }
}
/**
 * Returns the Taproot script public key.
 *
 * @param tapInternalKey - The Taproot internal key.
 * @param tapTree - The Taproot tree (optional).
 * @returns The Taproot script public key.
 */
function getTaprootScripPubkey(tapInternalKey, tapTree) {
  const scriptTree = tapTree && tapTreeFromList(tapTree.leaves);
  const { output } = (0, index_js_1.p2tr)({
    internalPubkey: tapInternalKey,
    scriptTree,
  });
  return output;
}
/**
 * Tweak the internal public key for a specific input.
 * @param inputIndex - The index of the input.
 * @param input - The PsbtInput object representing the input.
 * @returns The tweaked internal public key.
 * @throws Error if the tap internal key cannot be tweaked.
 */
function tweakInternalPubKey(inputIndex, input) {
  const tapInternalKey = input.tapInternalKey;
  const outputKey =
    tapInternalKey &&
    (0, bip341_js_1.tweakKey)(tapInternalKey, input.tapMerkleRoot);
  if (!outputKey)
    throw new Error(
      `Cannot tweak tap internal key for input #${inputIndex}. Public key: ${
        // tapInternalKey && tapInternalKey.toString('hex')
        tapInternalKey && tools.toHex(tapInternalKey)
      }`,
    );
  return outputKey.x;
}
/**
 * Convert a binary tree to a BIP371 type list. Each element of the list is (according to BIP371):
 * One or more tuples representing the depth, leaf version, and script for a leaf in the Taproot tree,
 * allowing the entire tree to be reconstructed. The tuples must be in depth first search order so that
 * the tree is correctly reconstructed.
 * @param tree the binary tap tree
 * @returns a list of BIP 371 tapleaves
 */
function tapTreeToList(tree) {
  if (!(0, types_js_1.isTaptree)(tree))
    throw new Error(
      'Cannot convert taptree to tapleaf list. Expecting a tapree structure.',
    );
  return _tapTreeToList(tree);
}
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
/**
 * Checks the taproot input for signatures.
 * @param input The PSBT input to check.
 * @param action The action being performed.
 * @returns True if the input has taproot signatures, false otherwise.
 */
function checkTaprootInputForSigs(input, action) {
  const sigs = extractTaprootSigs(input);
  return sigs.some(sig =>
    (0, psbtutils_js_2.signatureBlocksAction)(
      sig,
      decodeSchnorrSignature,
      action,
    ),
  );
}
/**
 * Decodes a Schnorr signature.
 * @param signature The signature to decode.
 * @returns The decoded Schnorr signature.
 */
function decodeSchnorrSignature(signature) {
  return {
    signature: signature.slice(0, 64),
    hashType:
      signature.slice(64)[0] || transaction_js_1.Transaction.SIGHASH_DEFAULT,
  };
}
/**
 * Extracts taproot signatures from a PSBT input.
 * @param input The PSBT input to extract signatures from.
 * @returns An array of taproot signatures.
 */
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
/**
 * Gets the taproot signature from the witness.
 * @param finalScriptWitness The final script witness.
 * @returns The taproot signature, or undefined if not found.
 */
function getTapKeySigFromWithness(finalScriptWitness) {
  if (!finalScriptWitness) return;
  const witness = finalScriptWitness.slice(2);
  // todo: add schnorr signature validation
  if (witness.length === 64 || witness.length === 65) return witness;
}
/**
 * Converts a binary tree to a BIP371 type list.
 * @param tree The binary tap tree.
 * @param leaves A list of tapleaves. Optional.
 * @param depth The current depth. Optional.
 * @returns A list of BIP 371 tapleaves.
 * @throws Throws an error if the taptree cannot be converted to a tapleaf list.
 */
function _tapTreeToList(tree, leaves = [], depth = 0) {
  if (depth > bip341_js_1.MAX_TAPTREE_DEPTH)
    throw new Error('Max taptree depth exceeded.');
  if (!tree) return [];
  if ((0, types_js_1.isTapleaf)(tree)) {
    leaves.push({
      depth,
      leafVersion: tree.version || bip341_js_1.LEAF_VERSION_TAPSCRIPT,
      script: tree.output,
    });
    return leaves;
  }
  if (tree[0]) _tapTreeToList(tree[0], leaves, depth + 1);
  if (tree[1]) _tapTreeToList(tree[1], leaves, depth + 1);
  return leaves;
}
/**
 * Inserts the tapleaves into the taproot tree.
 * @param leaves The tapleaves to insert.
 * @returns The taproot tree.
 * @throws Throws an error if there is no room left to insert a tapleaf in the tree.
 */
function instertLeavesInTree(leaves) {
  let tree;
  for (const leaf of leaves) {
    tree = instertLeafInTree(leaf, tree);
    if (!tree) throw new Error(`No room left to insert tapleaf in tree`);
  }
  return tree;
}
/**
 * Inserts a tapleaf into the taproot tree.
 * @param leaf The tapleaf to insert.
 * @param tree The taproot tree.
 * @param depth The current depth. Optional.
 * @returns The updated taproot tree.
 */
function instertLeafInTree(leaf, tree, depth = 0) {
  if (depth > bip341_js_1.MAX_TAPTREE_DEPTH)
    throw new Error('Max taptree depth exceeded.');
  if (leaf.depth === depth) {
    if (!tree)
      return {
        output: leaf.script,
        version: leaf.leafVersion,
      };
    return;
  }
  if ((0, types_js_1.isTapleaf)(tree)) return;
  const leftSide = instertLeafInTree(leaf, tree && tree[0], depth + 1);
  if (leftSide) return [leftSide, tree && tree[1]];
  const rightSide = instertLeafInTree(leaf, tree && tree[1], depth + 1);
  if (rightSide) return [tree && tree[0], rightSide];
}
/**
 * Checks the input fields for mixed taproot and non-taproot fields.
 * @param inputData The original input data.
 * @param newInputData The new input data.
 * @param action The action being performed.
 * @throws Throws an error if the input fields are inconsistent.
 */
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
/**
 * Checks the output fields for mixed taproot and non-taproot fields.
 * @param inputData The original output data.
 * @param newInputData The new output data.
 * @param action The action being performed.
 * @throws Throws an error if the output fields are inconsistent.
 */
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
  const leafHash = (0, bip341_js_1.tapleafHash)({
    output: tapLeaf.script,
    version: tapLeaf.leafVersion,
  });
  const rootHash = (0, bip341_js_1.rootHashFromPath)(
    tapLeaf.controlBlock,
    leafHash,
  );
  return tools.compare(rootHash, merkleRoot) === 0;
}
/**
 * Sorts the signatures in the input's tapScriptSig array based on their position in the tapLeaf script.
 *
 * @param input - The PsbtInput object.
 * @param tapLeaf - The TapLeafScript object.
 * @returns An array of sorted signatures as Buffers.
 */
function sortSignatures(input, tapLeaf) {
  const leafHash = (0, bip341_js_1.tapleafHash)({
    output: tapLeaf.script,
    version: tapLeaf.leafVersion,
  });
  return (
    (input.tapScriptSig || [])
      // .filter(tss => tss.leafHash.equals(leafHash))
      .filter(tss => tools.compare(tss.leafHash, leafHash) === 0)
      .map(tss => addPubkeyPositionInScript(tapLeaf.script, tss))
      .sort((t1, t2) => t2.positionInScript - t1.positionInScript)
      .map(t => t.signature)
  );
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
      positionInScript: (0, psbtutils_js_1.pubkeyPositionInScript)(
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
  const leafHash = (0, bip341_js_1.tapleafHash)({
    output: leaf.script,
    version: leaf.leafVersion,
  });
  const whiteListedHash = !hash || tools.compare(leafHash, hash) === 0;
  return (
    whiteListedHash &&
    tapScriptSig.find(tss => tools.compare(tss.leafHash, leafHash) === 0) !==
      undefined
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
