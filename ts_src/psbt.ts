import { Psbt as PsbtBase } from 'bip174';
import { Signer } from './ecpair';

export class Psbt extends PsbtBase {
  constructor() {
    super();
  }

  signInput(inputIndex: number, keyPair: Signer): Psbt {
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
