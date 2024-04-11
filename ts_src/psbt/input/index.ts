import { PsbtInput } from 'bip174/src/lib/interfaces';
import { checkTaprootInputForSigs, isTaprootInput } from '../bip371';
import { checkInputForSig } from '../psbtutils';
import { Output, Transaction } from '../../transaction';
import { PsbtCache } from '../interfaces';
import { checkTxInputCache, nonWitnessUtxoTxFromCache } from '../global/cache';
import {
  getMeaningfulScript,
  getScriptAndAmountFromUtxo,
  getScriptFromUtxo,
  scriptWitnessToWitnessStack,
  pubkeyInScript,
} from './script';
import { isP2TR } from '../../payments';

export function checkInputsForPartialSig(
  inputs: PsbtInput[],
  action: string,
): void {
  inputs.forEach(input => {
    const throws = isTaprootInput(input)
      ? checkTaprootInputForSigs(input, action)
      : checkInputForSig(input, action);
    if (throws)
      throw new Error('Can not modify transaction, signatures exist.');
  });
}

export function checkTxForDupeIns(tx: Transaction, cache: PsbtCache): void {
  tx.ins.forEach(input => {
    checkTxInputCache(cache, input);
  });
}

export function inputFinalizeGetAmts(
  inputs: PsbtInput[],
  tx: Transaction,
  cache: PsbtCache,
  mustFinalize: boolean,
): void {
  let inputAmount = 0;
  inputs.forEach((input, idx) => {
    if (mustFinalize && input.finalScriptSig)
      tx.ins[idx].script = input.finalScriptSig;
    if (mustFinalize && input.finalScriptWitness) {
      tx.ins[idx].witness = scriptWitnessToWitnessStack(
        input.finalScriptWitness,
      );
    }
    if (input.witnessUtxo) {
      inputAmount += input.witnessUtxo.value;
    } else if (input.nonWitnessUtxo) {
      const nwTx = nonWitnessUtxoTxFromCache(cache, input, idx);
      const vout = tx.ins[idx].index;
      const out = nwTx.outs[vout] as Output;
      inputAmount += out.value;
    }
  });
  const outputAmount = (tx.outs as Output[]).reduce(
    (total, o) => total + o.value,
    0,
  );
  const fee = inputAmount - outputAmount;
  if (fee < 0) {
    throw new Error('Outputs are spending more than Inputs');
  }
  const bytes = tx.virtualSize();
  cache.__FEE = fee;
  cache.__EXTRACTED_TX = tx;
  cache.__FEE_RATE = Math.floor(fee / bytes);
}

export function getPrevoutTaprootKey(
  inputIndex: number,
  input: PsbtInput,
  cache: PsbtCache,
): Buffer | null {
  const { script } = getScriptAndAmountFromUtxo(inputIndex, input, cache);
  return isP2TR(script) ? script.subarray(2, 34) : null;
}

export function pubkeyInInput(
  pubkey: Buffer,
  input: PsbtInput,
  inputIndex: number,
  cache: PsbtCache,
): boolean {
  const script = getScriptFromUtxo(inputIndex, input, cache);
  const { meaningfulScript } = getMeaningfulScript(
    script,
    inputIndex,
    'input',
    input.redeemScript,
    input.witnessScript,
  );
  return pubkeyInScript(pubkey, meaningfulScript);
}
