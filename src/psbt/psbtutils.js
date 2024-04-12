'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.isPubkeyLike =
  exports.range =
  exports.getSignersFromHD =
  exports.checkFees =
  exports.check32Bit =
    void 0;
const bscript = require('../script');
const utils_1 = require('bip174/src/lib/utils');
function check32Bit(num) {
  if (
    typeof num !== 'number' ||
    num !== Math.floor(num) ||
    num > 0xffffffff ||
    num < 0
  ) {
    throw new Error('Invalid 32 bit integer');
  }
}
exports.check32Bit = check32Bit;
function checkFees(psbt, cache, opts) {
  const feeRate = cache.__FEE_RATE || psbt.getFeeRate();
  const vsize = cache.__EXTRACTED_TX.virtualSize();
  const satoshis = feeRate * vsize;
  if (feeRate >= opts.maximumFeeRate) {
    throw new Error(
      `Warning: You are paying around ${(satoshis / 1e8).toFixed(8)} in ` +
        `fees, which is ${feeRate} satoshi per byte for a transaction ` +
        `with a VSize of ${vsize} bytes (segwit counted as 0.25 byte per ` +
        `byte). Use setMaximumFeeRate method to raise your threshold, or ` +
        `pass true to the first arg of extractTransaction.`,
    );
  }
}
exports.checkFees = checkFees;
function getSignersFromHD(inputIndex, inputs, hdKeyPair) {
  const input = (0, utils_1.checkForInput)(inputs, inputIndex);
  if (!input.bip32Derivation || input.bip32Derivation.length === 0) {
    throw new Error('Need bip32Derivation to sign with HD');
  }
  const myDerivations = input.bip32Derivation
    .map(bipDv => {
      if (bipDv.masterFingerprint.equals(hdKeyPair.fingerprint)) {
        return bipDv;
      } else {
        return;
      }
    })
    .filter(v => !!v);
  if (myDerivations.length === 0) {
    throw new Error(
      'Need one bip32Derivation masterFingerprint to match the HDSigner fingerprint',
    );
  }
  const signers = myDerivations.map(bipDv => {
    const node = hdKeyPair.derivePath(bipDv.path);
    if (!bipDv.pubkey.equals(node.publicKey)) {
      throw new Error('pubkey did not match bip32Derivation');
    }
    return node;
  });
  return signers;
}
exports.getSignersFromHD = getSignersFromHD;
function range(n) {
  return [...Array(n).keys()];
}
exports.range = range;
function isPubkeyLike(buf) {
  return buf.length === 33 && bscript.isCanonicalPubKey(buf);
}
exports.isPubkeyLike = isPubkeyLike;
