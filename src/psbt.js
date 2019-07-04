'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const bip174_1 = require('bip174');
const utils_1 = require('bip174/src/lib/utils');
const address_1 = require('./address');
const crypto_1 = require('./crypto');
const networks_1 = require('./networks');
const payments = require('./payments');
const bscript = require('./script');
const transaction_1 = require('./transaction');
const varuint = require('varuint-bitcoin');
class Psbt extends bip174_1.Psbt {
  constructor(opts = {}) {
    super();
    this.opts = Object.assign({}, DEFAULT_OPTS, opts);
    // // TODO: figure out a way to use a Transaction Object instead of a Buffer
    // // TODO: Caching, since .toBuffer() calls every time we get is lame.
    // this.__TX = Transaction.fromBuffer(this.globalMap.unsignedTx!);
    // delete this.globalMap.unsignedTx;
    // Object.defineProperty(this.globalMap, 'unsignedTx', {
    //   enumerable: true,
    //   writable: false,
    //   get(): Buffer {
    //     return this.__TX.toBuffer();
    //   }
    // });
  }
  addOutput(outputData, allowNoInput = false, transactionOutputAdder) {
    const { address } = outputData;
    if (typeof address === 'string') {
      const { network } = this.opts;
      const script = address_1.toOutputScript(address, network);
      outputData = Object.assign(outputData, { script });
    }
    return super.addOutput(outputData, allowNoInput, transactionOutputAdder);
  }
  extractTransaction() {
    if (!this.inputs.every(isFinalized)) throw new Error('Not finalized');
    const tx = transaction_1.Transaction.fromBuffer(this.globalMap.unsignedTx);
    this.inputs.forEach((input, idx) => {
      if (input.finalScriptSig) tx.ins[idx].script = input.finalScriptSig;
      if (input.finalScriptWitness) {
        tx.ins[idx].witness = scriptWitnessToWitnessStack(
          input.finalScriptWitness,
        );
      }
    });
    return tx;
  }
  finalizeAllInputs() {
    const inputResults = range(this.inputs.length).map(idx =>
      this.finalizeInput(idx),
    );
    const result = inputResults.every(val => val === true);
    return {
      result,
      inputResults,
    };
  }
  finalizeInput(inputIndex) {
    const input = utils_1.checkForInput(this.inputs, inputIndex);
    const { script, isP2SH, isP2WSH, isSegwit } = getScriptFromInput(
      inputIndex,
      input,
      this.globalMap.unsignedTx,
    );
    if (!script) return false;
    const scriptType = classifyScript(script);
    if (!canFinalize(input, script, scriptType)) return false;
    const { finalScriptSig, finalScriptWitness } = getFinalScripts(
      script,
      scriptType,
      input.partialSig,
      isSegwit,
      isP2SH,
      isP2WSH,
    );
    if (finalScriptSig)
      this.addFinalScriptSigToInput(inputIndex, finalScriptSig);
    if (finalScriptWitness)
      this.addFinalScriptWitnessToInput(inputIndex, finalScriptWitness);
    if (!finalScriptSig && !finalScriptWitness) return false;
    this.clearFinalizedInput(inputIndex);
    return true;
  }
  signInput(inputIndex, keyPair) {
    if (!keyPair || !keyPair.publicKey)
      throw new Error('Need Signer to sign input');
    const { hash, sighashType } = getHashAndSighashType(
      this.inputs,
      inputIndex,
      keyPair.publicKey,
      this.globalMap.unsignedTx,
    );
    const partialSig = {
      pubkey: keyPair.publicKey,
      signature: bscript.signature.encode(keyPair.sign(hash), sighashType),
    };
    return this.addPartialSigToInput(inputIndex, partialSig);
  }
  signInputAsync(inputIndex, keyPair) {
    if (!keyPair || !keyPair.publicKey)
      throw new Error('Need Signer to sign input');
    const { hash, sighashType } = getHashAndSighashType(
      this.inputs,
      inputIndex,
      keyPair.publicKey,
      this.globalMap.unsignedTx,
    );
    return keyPair.sign(hash).then(signature => {
      const partialSig = {
        pubkey: keyPair.publicKey,
        signature: bscript.signature.encode(signature, sighashType),
      };
      this.addPartialSigToInput(inputIndex, partialSig);
    });
  }
}
exports.Psbt = Psbt;
const DEFAULT_OPTS = {
  network: networks_1.bitcoin,
};
function isFinalized(input) {
  return !!input.finalScriptSig || !!input.finalScriptWitness;
}
function getHashAndSighashType(inputs, inputIndex, pubkey, txBuf) {
  const input = utils_1.checkForInput(inputs, inputIndex);
  const { hash, sighashType, script } = getHashForSig(inputIndex, input, txBuf);
  checkScriptForPubkey(pubkey, script);
  return {
    hash,
    sighashType,
  };
}
function getFinalScripts(
  script,
  scriptType,
  partialSig,
  isSegwit,
  isP2SH,
  isP2WSH,
) {
  let finalScriptSig;
  let finalScriptWitness;
  // Wow, the payments API is very handy
  const payment = getPayment(script, scriptType, partialSig);
  const p2wsh = !isP2WSH ? null : payments.p2wsh({ redeem: payment });
  const p2sh = !isP2SH ? null : payments.p2sh({ redeem: p2wsh || payment });
  if (isSegwit) {
    if (p2wsh) {
      finalScriptWitness = witnessStackToScriptWitness(p2wsh.witness);
    } else {
      finalScriptWitness = witnessStackToScriptWitness(payment.witness);
    }
    if (p2sh) {
      finalScriptSig = p2sh.input;
    }
  } else {
    if (p2sh) {
      finalScriptSig = p2sh.input;
    } else {
      finalScriptSig = payment.input;
    }
  }
  return {
    finalScriptSig,
    finalScriptWitness,
  };
}
function getSortedSigs(script, partialSig) {
  const p2ms = payments.p2ms({ output: script });
  // for each pubkey in order of p2ms script
  return p2ms.pubkeys
    .map(pk => {
      // filter partialSig array by pubkey being equal
      return (
        partialSig.filter(ps => {
          return ps.pubkey.equals(pk);
        })[0] || {}
      ).signature;
      // Any pubkey without a match will return undefined
      // this last filter removes all the undefined items in the array.
    })
    .filter(v => !!v);
}
function getPayment(script, scriptType, partialSig) {
  let payment;
  switch (scriptType) {
    case 'multisig':
      const sigs = getSortedSigs(script, partialSig);
      payment = payments.p2ms({
        output: script,
        signatures: sigs,
      });
      break;
    case 'pubkey':
      payment = payments.p2pk({
        output: script,
        signature: partialSig[0].signature,
      });
      break;
    case 'pubkeyhash':
      payment = payments.p2pkh({
        output: script,
        pubkey: partialSig[0].pubkey,
        signature: partialSig[0].signature,
      });
      break;
    case 'witnesspubkeyhash':
      payment = payments.p2wpkh({
        output: script,
        pubkey: partialSig[0].pubkey,
        signature: partialSig[0].signature,
      });
      break;
  }
  return payment;
}
function canFinalize(input, script, scriptType) {
  switch (scriptType) {
    case 'pubkey':
    case 'pubkeyhash':
    case 'witnesspubkeyhash':
      return hasSigs(1, input.partialSig);
    case 'multisig':
      const p2ms = payments.p2ms({ output: script });
      return hasSigs(p2ms.m, input.partialSig);
    default:
      return false;
  }
}
function checkScriptForPubkey(pubkey, script) {
  const pubkeyHash = crypto_1.hash160(pubkey);
  const decompiled = bscript.decompile(script);
  if (decompiled === null) throw new Error('Unknown script error');
  const hasKey = decompiled.some(element => {
    if (typeof element === 'number') return false;
    return element.equals(pubkey) || element.equals(pubkeyHash);
  });
  if (!hasKey) {
    throw new Error(
      `Can not sign for this input with the key ${pubkey.toString('hex')}`,
    );
  }
}
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
        input.witnessScript,
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
  const res = {
    script: null,
    isSegwit: false,
    isP2SH: false,
    isP2WSH: false,
  };
  if (input.nonWitnessUtxo) {
    if (input.redeemScript) {
      res.isP2SH = true;
      res.script = input.redeemScript;
    } else {
      const unsignedTx = transaction_1.Transaction.fromBuffer(_unsignedTx);
      const nonWitnessUtxoTx = transaction_1.Transaction.fromBuffer(
        input.nonWitnessUtxo,
      );
      const prevoutIndex = unsignedTx.ins[inputIndex].index;
      res.script = nonWitnessUtxoTx.outs[prevoutIndex].script;
    }
  } else if (input.witnessUtxo) {
    res.isSegwit = true;
    res.isP2SH = !!input.redeemScript;
    res.isP2WSH = !!input.witnessScript;
    if (input.witnessScript) {
      res.script = input.witnessScript;
    } else if (input.redeemScript) {
      res.script = payments.p2wpkh({
        hash: input.redeemScript.slice(2),
      }).output;
    } else {
      res.script = payments.p2wpkh({
        hash: input.witnessUtxo.script.slice(2),
      }).output;
    }
  }
  return res;
}
const hasSigs = (neededSigs, partialSig) => {
  if (!partialSig) return false;
  if (partialSig.length > neededSigs) throw new Error('Too many signatures');
  return partialSig.length === neededSigs;
};
function witnessStackToScriptWitness(witness) {
  let buffer = Buffer.allocUnsafe(0);
  function writeSlice(slice) {
    buffer = Buffer.concat([buffer, Buffer.from(slice)]);
  }
  function writeVarInt(i) {
    const currentLen = buffer.length;
    const varintLen = varuint.encodingLength(i);
    buffer = Buffer.concat([buffer, Buffer.allocUnsafe(varintLen)]);
    varuint.encode(i, buffer, currentLen);
  }
  function writeVarSlice(slice) {
    writeVarInt(slice.length);
    writeSlice(slice);
  }
  function writeVector(vector) {
    writeVarInt(vector.length);
    vector.forEach(writeVarSlice);
  }
  writeVector(witness);
  return buffer;
}
function scriptWitnessToWitnessStack(buffer) {
  let offset = 0;
  function readSlice(n) {
    offset += n;
    return buffer.slice(offset - n, offset);
  }
  function readVarInt() {
    const vi = varuint.decode(buffer, offset);
    offset += varuint.decode.bytes;
    return vi;
  }
  function readVarSlice() {
    return readSlice(readVarInt());
  }
  function readVector() {
    const count = readVarInt();
    const vector = [];
    for (let i = 0; i < count; i++) vector.push(readVarSlice());
    return vector;
  }
  return readVector();
}
const range = n => [...Array(n).keys()];
