'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.getScriptAndAmountFromUtxo =
  exports.getScriptFromUtxo =
  exports.checkScriptForPubkey =
  exports.scriptWitnessToWitnessStack =
  exports.classifyScript =
  exports.checkInvalidP2WSH =
  exports.getMeaningfulScript =
    void 0;
const bufferutils_1 = require('../../bufferutils');
const payments = require('../../payments');
const psbtutils_1 = require('../psbtutils');
const cache_1 = require('../global/cache');
function getMeaningfulScript(
  script,
  index,
  ioType,
  redeemScript,
  witnessScript,
) {
  const isP2SH = (0, psbtutils_1.isP2SHScript)(script);
  const isP2SHP2WSH =
    isP2SH && redeemScript && (0, psbtutils_1.isP2WSHScript)(redeemScript);
  const isP2WSH = (0, psbtutils_1.isP2WSHScript)(script);
  if (isP2SH && redeemScript === undefined)
    throw new Error('scriptPubkey is P2SH but redeemScript missing');
  if ((isP2WSH || isP2SHP2WSH) && witnessScript === undefined)
    throw new Error(
      'scriptPubkey or redeemScript is P2WSH but witnessScript missing',
    );
  let meaningfulScript;
  if (isP2SHP2WSH) {
    meaningfulScript = witnessScript;
    checkRedeemScript(index, script, redeemScript, ioType);
    checkWitnessScript(index, redeemScript, witnessScript, ioType);
    checkInvalidP2WSH(meaningfulScript);
  } else if (isP2WSH) {
    meaningfulScript = witnessScript;
    checkWitnessScript(index, script, witnessScript, ioType);
    checkInvalidP2WSH(meaningfulScript);
  } else if (isP2SH) {
    meaningfulScript = redeemScript;
    checkRedeemScript(index, script, redeemScript, ioType);
  } else {
    meaningfulScript = script;
  }
  return {
    meaningfulScript,
    type: isP2SHP2WSH
      ? 'p2sh-p2wsh'
      : isP2SH
      ? 'p2sh'
      : isP2WSH
      ? 'p2wsh'
      : 'raw',
  };
}
exports.getMeaningfulScript = getMeaningfulScript;
function checkInvalidP2WSH(script) {
  if (
    (0, psbtutils_1.isP2WPKH)(script) ||
    (0, psbtutils_1.isP2SHScript)(script)
  ) {
    throw new Error('P2WPKH or P2SH can not be contained within P2WSH');
  }
}
exports.checkInvalidP2WSH = checkInvalidP2WSH;
function classifyScript(script) {
  if ((0, psbtutils_1.isP2WPKH)(script)) return 'witnesspubkeyhash';
  if ((0, psbtutils_1.isP2PKH)(script)) return 'pubkeyhash';
  if ((0, psbtutils_1.isP2MS)(script)) return 'multisig';
  if ((0, psbtutils_1.isP2PK)(script)) return 'pubkey';
  return 'nonstandard';
}
exports.classifyScript = classifyScript;
function scriptWitnessToWitnessStack(buffer) {
  let offset = 0;
  function readSlice(n) {
    offset += n;
    return buffer.slice(offset - n, offset);
  }
  function readVarInt() {
    const vi = bufferutils_1.varuint.decode(buffer, offset);
    offset += bufferutils_1.varuint.decode.bytes;
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
exports.scriptWitnessToWitnessStack = scriptWitnessToWitnessStack;
function checkScriptForPubkey(pubkey, script, action) {
  if (!(0, psbtutils_1.pubkeyInScript)(pubkey, script)) {
    throw new Error(
      `Can not ${action} for this input with the key ${pubkey.toString('hex')}`,
    );
  }
}
exports.checkScriptForPubkey = checkScriptForPubkey;
function getScriptFromUtxo(inputIndex, input, cache) {
  const { script } = getScriptAndAmountFromUtxo(inputIndex, input, cache);
  return script;
}
exports.getScriptFromUtxo = getScriptFromUtxo;
function getScriptAndAmountFromUtxo(inputIndex, input, cache) {
  if (input.witnessUtxo !== undefined) {
    return {
      script: input.witnessUtxo.script,
      value: input.witnessUtxo.value,
    };
  } else if (input.nonWitnessUtxo !== undefined) {
    const nonWitnessUtxoTx = (0, cache_1.nonWitnessUtxoTxFromCache)(
      cache,
      input,
      inputIndex,
    );
    const o = nonWitnessUtxoTx.outs[cache.__TX.ins[inputIndex].index];
    return { script: o.script, value: o.value };
  } else {
    throw new Error("Can't find pubkey in input without Utxo data");
  }
}
exports.getScriptAndAmountFromUtxo = getScriptAndAmountFromUtxo;
function scriptCheckerFactory(payment, paymentScriptName) {
  return (inputIndex, scriptPubKey, redeemScript, ioType) => {
    const redeemScriptOutput = payment({
      redeem: { output: redeemScript },
    }).output;
    if (!scriptPubKey.equals(redeemScriptOutput)) {
      throw new Error(
        `${paymentScriptName} for ${ioType} #${inputIndex} doesn't match the scriptPubKey in the prevout`,
      );
    }
  };
}
const checkRedeemScript = scriptCheckerFactory(payments.p2sh, 'Redeem script');
const checkWitnessScript = scriptCheckerFactory(
  payments.p2wsh,
  'Witness script',
);
