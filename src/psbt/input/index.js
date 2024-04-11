'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.getPrevoutTaprootKey =
  exports.inputFinalizeGetAmts =
  exports.checkTxForDupeIns =
  exports.checkInputsForPartialSig =
    void 0;
const bip371_1 = require('../bip371');
const psbtutils_1 = require('../psbtutils');
const cache_1 = require('../global/cache');
const script_1 = require('./script');
function checkInputsForPartialSig(inputs, action) {
  inputs.forEach(input => {
    const throws = (0, bip371_1.isTaprootInput)(input)
      ? (0, bip371_1.checkTaprootInputForSigs)(input, action)
      : (0, psbtutils_1.checkInputForSig)(input, action);
    if (throws)
      throw new Error('Can not modify transaction, signatures exist.');
  });
}
exports.checkInputsForPartialSig = checkInputsForPartialSig;
function checkTxForDupeIns(tx, cache) {
  tx.ins.forEach(input => {
    (0, cache_1.checkTxInputCache)(cache, input);
  });
}
exports.checkTxForDupeIns = checkTxForDupeIns;
function inputFinalizeGetAmts(inputs, tx, cache, mustFinalize) {
  let inputAmount = 0;
  inputs.forEach((input, idx) => {
    if (mustFinalize && input.finalScriptSig)
      tx.ins[idx].script = input.finalScriptSig;
    if (mustFinalize && input.finalScriptWitness) {
      tx.ins[idx].witness = (0, script_1.scriptWitnessToWitnessStack)(
        input.finalScriptWitness,
      );
    }
    if (input.witnessUtxo) {
      inputAmount += input.witnessUtxo.value;
    } else if (input.nonWitnessUtxo) {
      const nwTx = (0, cache_1.nonWitnessUtxoTxFromCache)(cache, input, idx);
      const vout = tx.ins[idx].index;
      const out = nwTx.outs[vout];
      inputAmount += out.value;
    }
  });
  const outputAmount = tx.outs.reduce((total, o) => total + o.value, 0);
  const fee = inputAmount - outputAmount;
  if (fee < 0) {
    throw new Error('Outputs are spending more than Inputs');
  }
  const bytes = tx.virtualSize();
  cache.__FEE = fee;
  cache.__EXTRACTED_TX = tx;
  cache.__FEE_RATE = Math.floor(fee / bytes);
}
exports.inputFinalizeGetAmts = inputFinalizeGetAmts;
function getPrevoutTaprootKey(inputIndex, input, cache) {
  const { script } = (0, script_1.getScriptAndAmountFromUtxo)(
    inputIndex,
    input,
    cache,
  );
  return (0, psbtutils_1.isP2TR)(script) ? script.subarray(2, 34) : null;
}
exports.getPrevoutTaprootKey = getPrevoutTaprootKey;
