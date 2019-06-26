import { Psbt as PsbtBase } from 'bip174';
import { Signer } from './ecpair';

export class Psbt extends PsbtBase {
  constructor() {
    super();
  }

  signInput(inputIndex: number, keyPair: Signer): Psbt {
    // TODO: Implement BIP174 pre-sign checks:
    // https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki#signer
    //
    // if non_witness_utxo.exists:
    //     assert(sha256d(non_witness_utxo) == psbt.tx.innput[i].prevout.hash)
    //     if redeemScript.exists:
    //         assert(non_witness_utxo.vout[psbt.tx.input[i].prevout.n].scriptPubKey == P2SH(redeemScript))
    //         sign_non_witness(redeemScript)
    //     else:
    //         sign_non_witness(non_witness_utxo.vout[psbt.tx.input[i].prevout.n].scriptPubKey)
    // else if witness_utxo.exists:
    //     if redeemScript.exists:
    //         assert(witness_utxo.scriptPubKey == P2SH(redeemScript))
    //         script = redeemScript
    //     else:
    //         script = witness_utxo.scriptPubKey
    //     if IsP2WPKH(script):
    //         sign_witness(P2PKH(script[2:22]))
    //     else if IsP2WSH(script):
    //         assert(script == P2WSH(witnessScript))
    //         sign_witness(witnessScript)
    // else:
    //     assert False

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
