import { PsbtInput } from 'bip174/src/lib/interfaces';
import { reverseBuffer } from '../../bufferutils';
import { PsbtCache, TxCacheNumberKey } from '../interfaces';
import { Transaction } from '../../transaction';
import { isFinalized } from '.';
import { inputFinalizeGetAmts } from '../input';

export function checkCache(cache: PsbtCache): void {
  if (cache.__UNSAFE_SIGN_NONSEGWIT !== false) {
    throw new Error('Not BIP174 compliant, can not export');
  }
}

export function checkTxInputCache(
  cache: PsbtCache,
  input: { hash: Buffer; index: number },
): void {
  const key =
    reverseBuffer(Buffer.from(input.hash)).toString('hex') + ':' + input.index;
  if (cache.__TX_IN_CACHE[key]) throw new Error('Duplicate input detected.');
  cache.__TX_IN_CACHE[key] = 1;
}

export function getTxCacheValue(
  key: TxCacheNumberKey,
  name: string,
  inputs: PsbtInput[],
  c: PsbtCache,
): number | undefined {
  if (!inputs.every(isFinalized))
    throw new Error(`PSBT must be finalized to calculate ${name}`);
  if (key === '__FEE_RATE' && c.__FEE_RATE) return c.__FEE_RATE;
  if (key === '__FEE' && c.__FEE) return c.__FEE;
  let tx: Transaction;
  let mustFinalize = true;
  if (c.__EXTRACTED_TX) {
    tx = c.__EXTRACTED_TX;
    mustFinalize = false;
  } else {
    tx = c.__TX.clone();
  }
  inputFinalizeGetAmts(inputs, tx, c, mustFinalize);
  if (key === '__FEE_RATE') return c.__FEE_RATE!;
  else if (key === '__FEE') return c.__FEE!;
}

export function nonWitnessUtxoTxFromCache(
  cache: PsbtCache,
  input: PsbtInput,
  inputIndex: number,
): Transaction {
  const c = cache.__NON_WITNESS_UTXO_TX_CACHE;
  if (!c[inputIndex]) {
    addNonWitnessTxCache(cache, input, inputIndex);
  }
  return c[inputIndex];
}

export function addNonWitnessTxCache(
  cache: PsbtCache,
  input: PsbtInput,
  inputIndex: number,
): void {
  cache.__NON_WITNESS_UTXO_BUF_CACHE[inputIndex] = input.nonWitnessUtxo!;

  const tx = Transaction.fromBuffer(input.nonWitnessUtxo!);
  cache.__NON_WITNESS_UTXO_TX_CACHE[inputIndex] = tx;

  const self = cache;
  const selfIndex = inputIndex;
  delete input.nonWitnessUtxo;
  Object.defineProperty(input, 'nonWitnessUtxo', {
    enumerable: true,
    get(): Buffer {
      const buf = self.__NON_WITNESS_UTXO_BUF_CACHE[selfIndex];
      const txCache = self.__NON_WITNESS_UTXO_TX_CACHE[selfIndex];
      if (buf !== undefined) {
        return buf;
      } else {
        const newBuf = txCache.toBuffer();
        self.__NON_WITNESS_UTXO_BUF_CACHE[selfIndex] = newBuf;
        return newBuf;
      }
    },
    set(data: Buffer): void {
      self.__NON_WITNESS_UTXO_BUF_CACHE[selfIndex] = data;
    },
  });
}
