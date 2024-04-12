'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.signatureBlocksAction =
  exports.checkInputForSig =
  exports.isSigLike =
  exports.trimTaprootSig =
  exports.checkPartialSigSighashes =
  exports.hasSigs =
    void 0;
const script = require('../../script');
const transaction_1 = require('../../transaction');
function hasSigs(neededSigs, partialSig, pubkeys) {
  if (!partialSig) return false;
  let sigs;
  if (pubkeys) {
    sigs = pubkeys
      .map(pkey => {
        const pubkey = compressPubkey(pkey);
        return partialSig.find(pSig => pSig.pubkey.equals(pubkey));
      })
      .filter(v => !!v);
  } else {
    sigs = partialSig;
  }
  if (sigs.length > neededSigs) throw new Error('Too many signatures');
  return sigs.length === neededSigs;
}
exports.hasSigs = hasSigs;
function checkPartialSigSighashes(input) {
  if (!input.sighashType || !input.partialSig) return;
  const { partialSig, sighashType } = input;
  partialSig.forEach(pSig => {
    const { hashType } = script.signature.decode(pSig.signature);
    if (sighashType !== hashType) {
      throw new Error('Signature sighash does not match input sighash type');
    }
  });
}
exports.checkPartialSigSighashes = checkPartialSigSighashes;
function trimTaprootSig(signature) {
  return signature.length === 64 ? signature : signature.subarray(0, 64);
}
exports.trimTaprootSig = trimTaprootSig;
function isSigLike(buf) {
  return script.isCanonicalScriptSignature(buf);
}
exports.isSigLike = isSigLike;
/**
 * Checks if an input contains a signature for a specific action.
 * @param input - The input to check.
 * @param action - The action to check for.
 * @returns A boolean indicating whether the input contains a signature for the specified action.
 */
function checkInputForSig(input, action) {
  const pSigs = extractPartialSigs(input);
  return pSigs.some(pSig =>
    signatureBlocksAction(pSig, script.signature.decode, action),
  );
}
exports.checkInputForSig = checkInputForSig;
/**
 * Determines if a given action is allowed for a signature block.
 * @param signature - The signature block.
 * @param signatureDecodeFn - The function used to decode the signature.
 * @param action - The action to be checked.
 * @returns True if the action is allowed, false otherwise.
 */
function signatureBlocksAction(signature, signatureDecodeFn, action) {
  const { hashType } = signatureDecodeFn(signature);
  const whitelist = [];
  const isAnyoneCanPay =
    hashType & transaction_1.Transaction.SIGHASH_ANYONECANPAY;
  if (isAnyoneCanPay) whitelist.push('addInput');
  const hashMod = hashType & 0x1f;
  switch (hashMod) {
    case transaction_1.Transaction.SIGHASH_ALL:
      break;
    case transaction_1.Transaction.SIGHASH_SINGLE:
    case transaction_1.Transaction.SIGHASH_NONE:
      whitelist.push('addOutput');
      whitelist.push('setInputSequence');
      break;
  }
  if (whitelist.indexOf(action) === -1) {
    return true;
  }
  return false;
}
exports.signatureBlocksAction = signatureBlocksAction;
/**
 * Extracts the signatures from a PsbtInput object.
 * If the input has partial signatures, it returns an array of the signatures.
 * If the input does not have partial signatures, it checks if it has a finalScriptSig or finalScriptWitness.
 * If it does, it extracts the signatures from the final scripts and returns them.
 * If none of the above conditions are met, it returns an empty array.
 *
 * @param input - The PsbtInput object from which to extract the signatures.
 * @returns An array of signatures extracted from the PsbtInput object.
 */
function extractPartialSigs(input) {
  let pSigs = [];
  if ((input.partialSig || []).length === 0) {
    if (!input.finalScriptSig && !input.finalScriptWitness) return [];
    pSigs = getPsigsFromInputFinalScripts(input);
  } else {
    pSigs = input.partialSig;
  }
  return pSigs.map(p => p.signature);
}
/**
 * Retrieves the partial signatures (Psigs) from the input's final scripts.
 * Psigs are extracted from both the final scriptSig and final scriptWitness of the input.
 * Only canonical script signatures are considered.
 *
 * @param input - The PsbtInput object representing the input.
 * @returns An array of PartialSig objects containing the extracted Psigs.
 */
function getPsigsFromInputFinalScripts(input) {
  const scriptItems = !input.finalScriptSig
    ? []
    : script.decompile(input.finalScriptSig) || [];
  const witnessItems = !input.finalScriptWitness
    ? []
    : script.decompile(input.finalScriptWitness) || [];
  return scriptItems
    .concat(witnessItems)
    .filter(item => {
      return Buffer.isBuffer(item) && script.isCanonicalScriptSignature(item);
    })
    .map(sig => ({ signature: sig }));
}
function compressPubkey(pubkey) {
  if (pubkey.length === 65) {
    const parity = pubkey[64] & 1;
    const newKey = pubkey.slice(0, 33);
    newKey[0] = 2 | parity;
    return newKey;
  }
  return pubkey.slice();
}
