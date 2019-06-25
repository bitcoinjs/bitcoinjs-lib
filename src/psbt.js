'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const bip174_1 = require('bip174');
class Psbt extends bip174_1.Psbt {
  constructor() {
    super();
  }
  signInput(inputIndex, keyPair) {
    // TODO: Implement BIP174 pre-sign checks:
    // https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki#signer
    // TODO: Get hash to sign
    const hash = Buffer.alloc(32);
    const partialSig = {
      pubkey: keyPair.publicKey,
      signature: keyPair.sign(hash),
    };
    this.addPartialSigToInput(inputIndex, partialSig);
    return this;
  }
}
exports.Psbt = Psbt;
