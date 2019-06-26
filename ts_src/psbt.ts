import { Psbt as PsbtBase } from 'bip174';
import { Signer } from './ecpair';
import { Transaction } from './transaction';

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

    const input = this.inputs[inputIndex];
    if (input === undefined) throw new Error(`No input #${inputIndex}`);

    // If a non-witness UTXO is provided, its hash must match the hash specified in the prevout
    if (input.nonWitnessUtxo) {
      const unsignedTx = Transaction.fromBuffer(this.globalMap.unsignedTx!);
      const nonWitnessUtxoTx = Transaction.fromBuffer(input.nonWitnessUtxo);

      const inputHash = unsignedTx.ins[inputIndex].hash;
      const utxoHash = nonWitnessUtxoTx.getHash();

      if (Buffer.compare(inputHash, utxoHash) !== 0) {
        throw new Error(
          `Non-witness UTXO hash for input #${inputIndex} doesn't match the hash specified in the prevout`,
        );
      }
    }

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
