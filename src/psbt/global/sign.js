'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.isSigLike =
  exports.trimTaprootSig =
  exports.checkPartialSigSighashes =
  exports.hasSigs =
    void 0;
const script = require('../../script');
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
function compressPubkey(pubkey) {
  if (pubkey.length === 65) {
    const parity = pubkey[64] & 1;
    const newKey = pubkey.slice(0, 33);
    newKey[0] = 2 | parity;
    return newKey;
  }
  return pubkey.slice();
}
