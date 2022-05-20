'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.pubkeyInScript = exports.pubkeyPositionInScript = exports.witnessStackToScriptWitness = exports.isP2TR = exports.isP2SHScript = exports.isP2WSHScript = exports.isP2WPKH = exports.isP2PKH = exports.isP2PK = exports.isP2MS = void 0;
const varuint = require('bip174/src/lib/converter/varint');
const bscript = require('../script');
const crypto_1 = require('../crypto');
const payments = require('../payments');
function isPaymentFactory(payment) {
  return script => {
    try {
      payment({ output: script });
      return true;
    } catch (err) {
      return false;
    }
  };
}
exports.isP2MS = isPaymentFactory(payments.p2ms);
exports.isP2PK = isPaymentFactory(payments.p2pk);
exports.isP2PKH = isPaymentFactory(payments.p2pkh);
exports.isP2WPKH = isPaymentFactory(payments.p2wpkh);
exports.isP2WSHScript = isPaymentFactory(payments.p2wsh);
exports.isP2SHScript = isPaymentFactory(payments.p2sh);
exports.isP2TR = isPaymentFactory(payments.p2tr);
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
exports.witnessStackToScriptWitness = witnessStackToScriptWitness;
function pubkeyPositionInScript(pubkey, script) {
  const pubkeyHash = (0, crypto_1.hash160)(pubkey);
  const pubkeyXOnly = pubkey.slice(1, 33); // slice before calling?
  const decompiled = bscript.decompile(script);
  if (decompiled === null) throw new Error('Unknown script error');
  return decompiled.findIndex(element => {
    if (typeof element === 'number') return false;
    return (
      element.equals(pubkey) ||
      element.equals(pubkeyHash) ||
      element.equals(pubkeyXOnly)
    );
  });
}
exports.pubkeyPositionInScript = pubkeyPositionInScript;
function pubkeyInScript(pubkey, script) {
  return pubkeyPositionInScript(pubkey, script) !== -1;
}
exports.pubkeyInScript = pubkeyInScript;
