'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const bip174_1 = require('bip174');
const payments = require('./payments');
const bscript = require('./script');
const transaction_1 = require('./transaction');
const scriptCheckerFactory = (payment, paymentScriptName) => (
  inputIndex,
  scriptPubKey,
  redeemScript,
) => {
  const redeemScriptOutput = payment({
    redeem: { output: redeemScript },
  }).output;
  if (!scriptPubKey.equals(redeemScriptOutput)) {
    throw new Error(
      `${paymentScriptName} for input #${inputIndex} doesn't match the scriptPubKey in the prevout`,
    );
  }
};
const checkRedeemScript = scriptCheckerFactory(payments.p2sh, 'Redeem script');
const checkWitnessScript = scriptCheckerFactory(
  payments.p2wsh,
  'Witness script',
);
const isP2WPKH = script => {
  try {
    payments.p2wpkh({ output: script });
    return true;
  } catch (err) {
    return false;
  }
};
class Psbt extends bip174_1.Psbt {
  constructor() {
    super();
  }
  signInput(inputIndex, keyPair) {
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
    const unsignedTx = transaction_1.Transaction.fromBuffer(
      this.globalMap.unsignedTx,
    );
    const sighashType = input.sighashType || 0x01;
    let hash;
    if (input.nonWitnessUtxo) {
      const nonWitnessUtxoTx = transaction_1.Transaction.fromBuffer(
        input.nonWitnessUtxo,
      );
      const prevoutHash = unsignedTx.ins[inputIndex].hash;
      const utxoHash = nonWitnessUtxoTx.getHash();
      // If a non-witness UTXO is provided, its hash must match the hash specified in the prevout
      if (!prevoutHash.equals(utxoHash)) {
        throw new Error(
          `Non-witness UTXO hash for input #${inputIndex} doesn't match the hash specified in the prevout`,
        );
      }
      const prevoutIndex = unsignedTx.ins[inputIndex].index;
      const prevout = nonWitnessUtxoTx.outs[prevoutIndex];
      if (input.redeemScript) {
        // If a redeemScript is provided, the scriptPubKey must be for that redeemScript
        checkRedeemScript(inputIndex, prevout.script, input.redeemScript);
        hash = unsignedTx.hashForSignature(
          inputIndex,
          input.redeemScript,
          sighashType,
        );
      } else {
        hash = unsignedTx.hashForSignature(
          inputIndex,
          prevout.script,
          sighashType,
        );
      }
    } else if (input.witnessUtxo) {
      let script;
      if (input.redeemScript) {
        // If a redeemScript is provided, the scriptPubKey must be for that redeemScript
        checkRedeemScript(
          inputIndex,
          input.witnessUtxo.script,
          input.redeemScript,
        );
        script = input.redeemScript;
      } else {
        script = input.witnessUtxo.script;
      }
      if (isP2WPKH(script)) {
        // P2WPKH uses the P2PKH template for prevoutScript when signing
        const signingScript = payments.p2pkh({ hash: script.slice(2) }).output;
        hash = unsignedTx.hashForWitnessV0(
          inputIndex,
          signingScript,
          input.witnessUtxo.value,
          sighashType,
        );
      } else {
        if (!input.witnessScript)
          throw new Error('Segwit input needs witnessScript if not P2WPKH');
        checkWitnessScript(inputIndex, script, input.witnessScript);
        hash = unsignedTx.hashForWitnessV0(
          inputIndex,
          script,
          input.witnessUtxo.value,
          sighashType,
        );
      }
    } else {
      throw new Error('Need a Utxo input item for signing');
    }
    const partialSig = {
      pubkey: keyPair.publicKey,
      signature: bscript.signature.encode(keyPair.sign(hash), sighashType),
    };
    return this.addPartialSigToInput(inputIndex, partialSig);
  }
}
exports.Psbt = Psbt;
