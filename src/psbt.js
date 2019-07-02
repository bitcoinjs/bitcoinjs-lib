'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const bip174_1 = require('bip174');
const utils_1 = require('bip174/src/lib/utils');
const payments = require('./payments');
const bscript = require('./script');
const transaction_1 = require('./transaction');
class Psbt extends bip174_1.Psbt {
  constructor(network) {
    super();
    this.network = network;
  }
  canFinalize(inputIndex) {
    const input = utils_1.checkForInput(this.inputs, inputIndex);
    const script = getScriptFromInput(
      inputIndex,
      input,
      this.globalMap.unsignedTx,
    );
    if (!script) return false;
    const scriptType = classifyScript(script);
    // TODO: for each type
    switch (scriptType) {
      case 'pubkey':
        return false;
      case 'pubkeyhash':
        return false;
      case 'multisig':
        return false;
      case 'witnesspubkeyhash':
        return false;
      default:
        return false;
    }
  }
  signInput(inputIndex, keyPair) {
    const input = this.inputs[inputIndex];
    if (input === undefined) throw new Error(`No input #${inputIndex}`);
    const { hash, sighashType } = getHashForSig(
      inputIndex,
      input,
      this.globalMap.unsignedTx,
    );
    const pubkey = keyPair.publicKey;
    // // TODO: throw error when the pubkey or pubkey hash is not found anywhere
    // // in the script
    // const pubkeyHash = hash160(keyPair.publicKey);
    //
    // const decompiled = bscript.decompile(script);
    // if (decompiled === null) throw new Error('Unknown script error');
    //
    // const hasKey = decompiled.some(element => {
    //   if (typeof element === 'number') return false;
    //   return element.equals(pubkey) || element.equals(pubkeyHash);
    // });
    //
    // if (!hasKey) {
    //   throw new Error(
    //     `Can not sign for this input with the key ${pubkey.toString('hex')}`,
    //   );
    // }
    const partialSig = {
      pubkey,
      signature: bscript.signature.encode(keyPair.sign(hash), sighashType),
    };
    return this.addPartialSigToInput(inputIndex, partialSig);
  }
}
exports.Psbt = Psbt;
const getHashForSig = (inputIndex, input, txBuf) => {
  const unsignedTx = transaction_1.Transaction.fromBuffer(txBuf);
  const sighashType =
    input.sighashType || transaction_1.Transaction.SIGHASH_ALL;
  let hash;
  let script;
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
      script = input.redeemScript;
      hash = unsignedTx.hashForSignature(
        inputIndex,
        input.redeemScript,
        sighashType,
      );
    } else {
      script = prevout.script;
      hash = unsignedTx.hashForSignature(
        inputIndex,
        prevout.script,
        sighashType,
      );
    }
  } else if (input.witnessUtxo) {
    let _script; // so we don't shadow the `let script` above
    if (input.redeemScript) {
      // If a redeemScript is provided, the scriptPubKey must be for that redeemScript
      checkRedeemScript(
        inputIndex,
        input.witnessUtxo.script,
        input.redeemScript,
      );
      _script = input.redeemScript;
    } else {
      _script = input.witnessUtxo.script;
    }
    if (isP2WPKH(_script)) {
      // P2WPKH uses the P2PKH template for prevoutScript when signing
      const signingScript = payments.p2pkh({ hash: _script.slice(2) }).output;
      hash = unsignedTx.hashForWitnessV0(
        inputIndex,
        signingScript,
        input.witnessUtxo.value,
        sighashType,
      );
      script = _script;
    } else {
      if (!input.witnessScript)
        throw new Error('Segwit input needs witnessScript if not P2WPKH');
      checkWitnessScript(inputIndex, _script, input.witnessScript);
      hash = unsignedTx.hashForWitnessV0(
        inputIndex,
        _script,
        input.witnessUtxo.value,
        sighashType,
      );
      // want to make sure the script we return is the actual meaningful script
      script = input.witnessScript;
    }
  } else {
    throw new Error('Need a Utxo input item for signing');
  }
  return {
    script,
    sighashType,
    hash,
  };
};
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
const isPaymentFactory = payment => script => {
  try {
    payment({ output: script });
    return true;
  } catch (err) {
    return false;
  }
};
const isP2WPKH = isPaymentFactory(payments.p2wpkh);
const isP2PKH = isPaymentFactory(payments.p2pkh);
const isP2MS = isPaymentFactory(payments.p2ms);
const isP2PK = isPaymentFactory(payments.p2pk);
const classifyScript = script => {
  if (isP2WPKH(script)) return 'witnesspubkeyhash';
  if (isP2PKH(script)) return 'pubkeyhash';
  if (isP2MS(script)) return 'multisig';
  if (isP2PK(script)) return 'pubkey';
  return 'nonstandard';
};
function getScriptFromInput(inputIndex, input, _unsignedTx) {
  let script;
  if (input.nonWitnessUtxo) {
    if (input.redeemScript) {
      script = input.redeemScript;
    } else {
      const unsignedTx = transaction_1.Transaction.fromBuffer(_unsignedTx);
      const nonWitnessUtxoTx = transaction_1.Transaction.fromBuffer(
        input.nonWitnessUtxo,
      );
      const prevoutIndex = unsignedTx.ins[inputIndex].index;
      script = nonWitnessUtxoTx.outs[prevoutIndex].script;
    }
  } else if (input.witnessUtxo) {
    if (input.witnessScript) {
      script = input.witnessScript;
    } else if (input.redeemScript) {
      script = payments.p2pkh({ hash: input.redeemScript.slice(2) }).output;
    } else {
      script = payments.p2pkh({ hash: input.witnessUtxo.script.slice(2) })
        .output;
    }
  } else {
    return;
  }
  return script;
}
