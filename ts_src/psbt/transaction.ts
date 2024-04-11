import { reverseBuffer } from '../bufferutils';
import { Transaction } from '../transaction';
import {
  Transaction as ITransaction,
  TransactionFromBuffer,
} from 'bip174/src/lib/interfaces';

/**
 * This class implements the Transaction interface from bip174 library.
 * It contains a bitcoinjs-lib Transaction object.
 */
export class PsbtTransaction implements ITransaction {
  tx: Transaction;
  constructor(buffer: Buffer = Buffer.from([2, 0, 0, 0, 0, 0, 0, 0, 0, 0])) {
    this.tx = Transaction.fromBuffer(buffer);
    this.checkTxEmpty(this.tx);
    Object.defineProperty(this, 'tx', {
      enumerable: false,
      writable: true,
    });
  }

  getInputOutputCounts(): {
    inputCount: number;
    outputCount: number;
  } {
    return {
      inputCount: this.tx.ins.length,
      outputCount: this.tx.outs.length,
    };
  }

  addInput(input: any): void {
    if (
      (input as any).hash === undefined ||
      (input as any).index === undefined ||
      (!Buffer.isBuffer((input as any).hash) &&
        typeof (input as any).hash !== 'string') ||
      typeof (input as any).index !== 'number'
    ) {
      throw new Error('Error adding input.');
    }
    const hash =
      typeof input.hash === 'string'
        ? reverseBuffer(Buffer.from(input.hash, 'hex'))
        : input.hash;
    this.tx.addInput(hash, input.index, input.sequence);
  }

  addOutput(output: any): void {
    if (
      (output as any).script === undefined ||
      (output as any).value === undefined ||
      !Buffer.isBuffer((output as any).script) ||
      typeof (output as any).value !== 'number'
    ) {
      throw new Error('Error adding output.');
    }
    this.tx.addOutput(output.script, output.value);
  }

  toBuffer(): Buffer {
    return this.tx.toBuffer();
  }

  checkTxEmpty(tx: Transaction): void {
    const isEmpty = tx.ins.every(
      input =>
        input.script &&
        input.script.length === 0 &&
        input.witness &&
        input.witness.length === 0,
    );
    if (!isEmpty) {
      throw new Error('Format Error: Transaction ScriptSigs are not empty');
    }
  }
}

/**
 * This function is needed to pass to the bip174 base class's fromBuffer.
 * It takes the "transaction buffer" portion of the psbt buffer and returns a
 * Transaction (From the bip174 library) interface.
 */
export const transactionFromBuffer: TransactionFromBuffer = (
  buffer: Buffer,
): ITransaction => new PsbtTransaction(buffer);
