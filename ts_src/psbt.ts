import { Psbt as PsbtBase } from 'bip174';
import {
  NonWitnessUtxo,
  PartialSig,
  PsbtInput,
  TransactionInput,
  TransactionOutput,
} from 'bip174/src/lib/interfaces';
import { checkForInput } from 'bip174/src/lib/utils';
import { toOutputScript } from './address';
import { reverseBuffer } from './bufferutils';
import { hash160 } from './crypto';
import { Signer, SignerAsync } from './ecpair';
import { bitcoin as btcNetwork, Network } from './networks';
import * as payments from './payments';
import * as bscript from './script';
import { Output, Transaction } from './transaction';
const varuint = require('varuint-bitcoin');

export class Psbt extends PsbtBase {
  static fromTransaction<T extends typeof PsbtBase>(
    this: T,
    txBuf: Buffer,
  ): InstanceType<T> {
    const tx = Transaction.fromBuffer(txBuf);
    checkTxEmpty(tx);
    const psbt = new this() as Psbt;
    psbt.__TX = tx;
    let inputCount = tx.ins.length;
    let outputCount = tx.outs.length;
    while (inputCount > 0) {
      psbt.inputs.push({
        keyVals: [],
      });
      inputCount--;
    }
    while (outputCount > 0) {
      psbt.outputs.push({
        keyVals: [],
      });
      outputCount--;
    }
    return psbt as InstanceType<T>;
  }
  static fromBuffer<T extends typeof PsbtBase>(
    this: T,
    buffer: Buffer,
  ): InstanceType<T> {
    let tx: Transaction | undefined;
    const txCountGetter = (
      txBuf: Buffer,
    ): {
      inputCount: number;
      outputCount: number;
    } => {
      tx = Transaction.fromBuffer(txBuf);
      checkTxEmpty(tx);
      return {
        inputCount: tx.ins.length,
        outputCount: tx.outs.length,
      };
    };
    const psbt = super.fromBuffer(buffer, txCountGetter) as Psbt;
    psbt.__TX = tx!;
    return psbt as InstanceType<T>;
  }
  private __TX: Transaction;
  private __TX_BUF_CACHE?: Buffer;
  private __FEE_RATE?: number;
  private __EXTRACTED_TX?: Transaction;
  private __NON_WITNESS_UTXO_TX_CACHE: Transaction[] = [];
  private __NON_WITNESS_UTXO_BUF_CACHE: Buffer[] = [];
  private opts: PsbtOpts;
  constructor(opts: PsbtOptsOptional = {}) {
    super();
    // set defaults
    this.opts = Object.assign({}, DEFAULT_OPTS, opts);
    this.__TX = Transaction.fromBuffer(this.globalMap.unsignedTx!);
    this.setVersion(2);

    // set cache
    const self = this;
    delete this.globalMap.unsignedTx;
    Object.defineProperty(this.globalMap, 'unsignedTx', {
      enumerable: true,
      get(): Buffer {
        if (self.__TX_BUF_CACHE !== undefined) {
          return self.__TX_BUF_CACHE;
        } else {
          self.__TX_BUF_CACHE = self.__TX.toBuffer();
          return self.__TX_BUF_CACHE;
        }
      },
      set(data: Buffer): void {
        self.__TX_BUF_CACHE = data;
      },
    });

    // Make data hidden when enumerating
    const dpew = (
      obj: any,
      attr: string,
      enumerable: boolean,
      writable: boolean,
    ): any =>
      Object.defineProperty(obj, attr, {
        enumerable,
        writable,
      });
    dpew(this, '__TX', false, true);
    dpew(this, '__EXTRACTED_TX', false, true);
    dpew(this, '__FEE_RATE', false, true);
    dpew(this, '__TX_BUF_CACHE', false, true);
    dpew(this, '__NON_WITNESS_UTXO_TX_CACHE', false, true);
    dpew(this, '__NON_WITNESS_UTXO_BUF_CACHE', false, true);
    dpew(this, 'opts', false, true);
  }

  setMaximumFeeRate(satoshiPerByte: number): void {
    check32Bit(satoshiPerByte); // 42.9 BTC per byte IS excessive... so throw
    this.opts.maximumFeeRate = satoshiPerByte;
  }

  setVersion(version: number): this {
    check32Bit(version);
    checkInputsForPartialSig(this.inputs, 'setVersion');
    this.__TX.version = version;
    this.__TX_BUF_CACHE = undefined;
    this.__EXTRACTED_TX = undefined;
    return this;
  }

  setLocktime(locktime: number): this {
    check32Bit(locktime);
    checkInputsForPartialSig(this.inputs, 'setLocktime');
    this.__TX.locktime = locktime;
    this.__TX_BUF_CACHE = undefined;
    this.__EXTRACTED_TX = undefined;
    return this;
  }

  setSequence(inputIndex: number, sequence: number): this {
    check32Bit(sequence);
    checkInputsForPartialSig(this.inputs, 'setSequence');
    if (this.__TX.ins.length <= inputIndex) {
      throw new Error('Input index too high');
    }
    this.__TX.ins[inputIndex].sequence = sequence;
    this.__TX_BUF_CACHE = undefined;
    this.__EXTRACTED_TX = undefined;
    return this;
  }

  addInput(inputData: TransactionInput): this {
    checkInputsForPartialSig(this.inputs, 'addInput');
    const self = this;
    const inputAdder = (
      _inputData: TransactionInput,
      txBuf: Buffer,
    ): Buffer => {
      if (
        !txBuf ||
        (_inputData as any).hash === undefined ||
        (_inputData as any).index === undefined ||
        (!Buffer.isBuffer((_inputData as any).hash) &&
          typeof (_inputData as any).hash !== 'string') ||
        typeof (_inputData as any).index !== 'number'
      ) {
        throw new Error('Error adding input.');
      }
      const prevHash = Buffer.isBuffer(_inputData.hash)
        ? _inputData.hash
        : reverseBuffer(Buffer.from(_inputData.hash, 'hex'));
      self.__TX.ins.push({
        hash: prevHash,
        index: _inputData.index,
        script: Buffer.alloc(0),
        sequence: _inputData.sequence || Transaction.DEFAULT_SEQUENCE,
        witness: [],
      });
      return self.__TX.toBuffer();
    };
    super.addInput(inputData, inputAdder);
    this.__FEE_RATE = undefined;
    this.__EXTRACTED_TX = undefined;
    return this;
  }

  addOutput(outputData: TransactionOutput): this {
    checkInputsForPartialSig(this.inputs, 'addOutput');
    const { address } = outputData as any;
    if (typeof address === 'string') {
      const { network } = this.opts;
      const script = toOutputScript(address, network);
      outputData = Object.assign(outputData, { script });
    }
    const self = this;
    const outputAdder = (
      _outputData: TransactionOutput,
      txBuf: Buffer,
    ): Buffer => {
      if (
        !txBuf ||
        (_outputData as any).script === undefined ||
        (_outputData as any).value === undefined ||
        !Buffer.isBuffer((_outputData as any).script) ||
        typeof (_outputData as any).value !== 'number'
      ) {
        throw new Error('Error adding output.');
      }
      self.__TX.outs.push({
        script: (_outputData as any).script!,
        value: _outputData.value,
      });
      return self.__TX.toBuffer();
    };
    super.addOutput(outputData, true, outputAdder);
    this.__FEE_RATE = undefined;
    this.__EXTRACTED_TX = undefined;
    return this;
  }

  addNonWitnessUtxoToInput(
    inputIndex: number,
    nonWitnessUtxo: NonWitnessUtxo,
  ): this {
    super.addNonWitnessUtxoToInput(inputIndex, nonWitnessUtxo);
    const input = this.inputs[inputIndex];
    addNonWitnessTxCache(this, input, inputIndex);
    return this;
  }

  extractTransaction(disableFeeCheck?: boolean): Transaction {
    if (!this.inputs.every(isFinalized)) throw new Error('Not finalized');
    if (!disableFeeCheck) {
      const feeRate = this.__FEE_RATE || this.getFeeRate();
      const vsize = this.__EXTRACTED_TX!.virtualSize();
      const satoshis = feeRate * vsize;
      if (feeRate >= this.opts.maximumFeeRate) {
        throw new Error(
          `Warning: You are paying around ${satoshis / 1e8} in fees, which ` +
            `is ${feeRate} satoshi per byte for a transaction with a VSize of ` +
            `${vsize} bytes (segwit counted as 0.25 byte per byte)\n` +
            `Use setMaximumFeeRate method to raise your threshold, or pass ` +
            `true to the first arg of extractTransaction.`,
        );
      }
    }
    if (this.__EXTRACTED_TX) return this.__EXTRACTED_TX;
    const tx = this.__TX.clone();
    this.inputs.forEach((input, idx) => {
      if (input.finalScriptSig) tx.ins[idx].script = input.finalScriptSig;
      if (input.finalScriptWitness) {
        tx.ins[idx].witness = scriptWitnessToWitnessStack(
          input.finalScriptWitness,
        );
      }
    });
    this.__EXTRACTED_TX = tx;
    return tx;
  }

  getFeeRate(): number {
    if (!this.inputs.every(isFinalized))
      throw new Error('PSBT must be finalized to calculate fee rate');
    if (this.__FEE_RATE) return this.__FEE_RATE;
    let tx: Transaction;
    let inputAmount = 0;
    let mustFinalize = true;
    if (this.__EXTRACTED_TX) {
      tx = this.__EXTRACTED_TX;
      mustFinalize = false;
    } else {
      tx = this.__TX.clone();
    }
    this.inputs.forEach((input, idx) => {
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
        // @ts-ignore
        if (!this.__NON_WITNESS_UTXO_TX_CACHE[idx]) {
          addNonWitnessTxCache(this, input, idx);
        }
        const vout = this.__TX.ins[idx].index;
        const out = this.__NON_WITNESS_UTXO_TX_CACHE[idx].outs[vout] as Output;
        inputAmount += out.value;
      } else {
        throw new Error('Missing input value: index #' + idx);
      }
    });
    this.__EXTRACTED_TX = tx;
    const outputAmount = (tx.outs as Output[]).reduce(
      (total, o) => total + o.value,
      0,
    );
    const fee = inputAmount - outputAmount;
    const bytes = tx.virtualSize();
    this.__FEE_RATE = Math.floor(fee / bytes);
    return this.__FEE_RATE;
  }

  finalizeAllInputs(): {
    result: boolean;
    inputResults: boolean[];
  } {
    const inputResults = range(this.inputs.length).map(idx =>
      this.finalizeInput(idx),
    );
    const result = inputResults.every(val => val === true);
    return {
      result,
      inputResults,
    };
  }

  finalizeInput(inputIndex: number): boolean {
    const input = checkForInput(this.inputs, inputIndex);
    const { script, isP2SH, isP2WSH, isSegwit } = getScriptFromInput(
      inputIndex,
      input,
      this.__TX,
      this,
    );
    if (!script) return false;

    const scriptType = classifyScript(script);
    if (!canFinalize(input, script, scriptType)) return false;

    const { finalScriptSig, finalScriptWitness } = getFinalScripts(
      script,
      scriptType,
      input.partialSig!,
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

  signInput(inputIndex: number, keyPair: Signer): this {
    if (!keyPair || !keyPair.publicKey)
      throw new Error('Need Signer to sign input');
    const { hash, sighashType } = getHashAndSighashType(
      this.inputs,
      inputIndex,
      keyPair.publicKey,
      this.__TX,
      this,
    );

    const partialSig = {
      pubkey: keyPair.publicKey,
      signature: bscript.signature.encode(keyPair.sign(hash), sighashType),
    };

    return this.addPartialSigToInput(inputIndex, partialSig);
  }

  signInputAsync(inputIndex: number, keyPair: SignerAsync): Promise<void> {
    return new Promise(
      (resolve, reject): void => {
        if (!keyPair || !keyPair.publicKey)
          return reject(new Error('Need Signer to sign input'));
        const { hash, sighashType } = getHashAndSighashType(
          this.inputs,
          inputIndex,
          keyPair.publicKey,
          this.__TX,
          this,
        );

        Promise.resolve(keyPair.sign(hash)).then(signature => {
          const partialSig = {
            pubkey: keyPair.publicKey,
            signature: bscript.signature.encode(signature, sighashType),
          };

          this.addPartialSigToInput(inputIndex, partialSig);
          resolve();
        });
      },
    );
  }
}

//
//
//
//
// Helper functions
//
//
//
//

interface PsbtOptsOptional {
  network?: Network;
  maximumFeeRate?: number;
}

interface PsbtOpts {
  network: Network;
  maximumFeeRate: number;
}

const DEFAULT_OPTS = {
  network: btcNetwork,
  maximumFeeRate: 5000, // satoshi per byte
};

function addNonWitnessTxCache(
  psbt: Psbt,
  input: PsbtInput,
  inputIndex: number,
): void {
  // @ts-ignore
  psbt.__NON_WITNESS_UTXO_BUF_CACHE[inputIndex] = input.nonWitnessUtxo!;

  const tx = Transaction.fromBuffer(input.nonWitnessUtxo!);
  // @ts-ignore
  psbt.__NON_WITNESS_UTXO_TX_CACHE[inputIndex] = tx;

  const self = psbt;
  const selfIndex = inputIndex;
  delete input.nonWitnessUtxo;
  Object.defineProperty(input, 'nonWitnessUtxo', {
    enumerable: true,
    get(): Buffer {
      // @ts-ignore
      if (self.__NON_WITNESS_UTXO_BUF_CACHE[selfIndex] !== undefined) {
        // @ts-ignore
        return self.__NON_WITNESS_UTXO_BUF_CACHE[selfIndex];
      } else {
        // @ts-ignore
        self.__NON_WITNESS_UTXO_BUF_CACHE[
          selfIndex
          // @ts-ignore
        ] = self.__NON_WITNESS_UTXO_TX_CACHE[selfIndex].toBuffer();
        // @ts-ignore
        return self.__NON_WITNESS_UTXO_BUF_CACHE[selfIndex];
      }
    },
    set(data: Buffer): void {
      // @ts-ignore
      self.__NON_WITNESS_UTXO_BUF_CACHE[selfIndex] = data;
    },
  });
}

function isFinalized(input: PsbtInput): boolean {
  return !!input.finalScriptSig || !!input.finalScriptWitness;
}

function getHashAndSighashType(
  inputs: PsbtInput[],
  inputIndex: number,
  pubkey: Buffer,
  unsignedTx: Transaction,
  psbt: Psbt,
): {
  hash: Buffer;
  sighashType: number;
} {
  const input = checkForInput(inputs, inputIndex);
  const { hash, sighashType, script } = getHashForSig(
    inputIndex,
    input,
    unsignedTx,
    psbt,
  );
  checkScriptForPubkey(pubkey, script);
  return {
    hash,
    sighashType,
  };
}

function getFinalScripts(
  script: Buffer,
  scriptType: string,
  partialSig: PartialSig[],
  isSegwit: boolean,
  isP2SH: boolean,
  isP2WSH: boolean,
): {
  finalScriptSig: Buffer | undefined;
  finalScriptWitness: Buffer | undefined;
} {
  let finalScriptSig: Buffer | undefined;
  let finalScriptWitness: Buffer | undefined;

  // Wow, the payments API is very handy
  const payment: payments.Payment = getPayment(script, scriptType, partialSig);
  const p2wsh = !isP2WSH ? null : payments.p2wsh({ redeem: payment });
  const p2sh = !isP2SH ? null : payments.p2sh({ redeem: p2wsh || payment });

  if (isSegwit) {
    if (p2wsh) {
      finalScriptWitness = witnessStackToScriptWitness(p2wsh.witness!);
    } else {
      finalScriptWitness = witnessStackToScriptWitness(payment.witness!);
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

function getSortedSigs(script: Buffer, partialSig: PartialSig[]): Buffer[] {
  const p2ms = payments.p2ms({ output: script });
  // for each pubkey in order of p2ms script
  return p2ms
    .pubkeys!.map(pk => {
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

function getPayment(
  script: Buffer,
  scriptType: string,
  partialSig: PartialSig[],
): payments.Payment {
  let payment: payments.Payment;
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
  return payment!;
}

function canFinalize(
  input: PsbtInput,
  script: Buffer,
  scriptType: string,
): boolean {
  switch (scriptType) {
    case 'pubkey':
    case 'pubkeyhash':
    case 'witnesspubkeyhash':
      return hasSigs(1, input.partialSig);
    case 'multisig':
      const p2ms = payments.p2ms({ output: script });
      return hasSigs(p2ms.m!, input.partialSig);
    default:
      return false;
  }
}

function checkScriptForPubkey(pubkey: Buffer, script: Buffer): void {
  const pubkeyHash = hash160(pubkey);

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

interface HashForSigData {
  script: Buffer;
  hash: Buffer;
  sighashType: number;
}

const getHashForSig = (
  inputIndex: number,
  input: PsbtInput,
  unsignedTx: Transaction,
  psbt: Psbt,
): HashForSigData => {
  const sighashType = input.sighashType || Transaction.SIGHASH_ALL;
  let hash: Buffer;
  let script: Buffer;

  if (input.nonWitnessUtxo) {
    // @ts-ignore
    if (!psbt.__NON_WITNESS_UTXO_TX_CACHE[inputIndex]) {
      addNonWitnessTxCache(psbt, input, inputIndex);
    }
    // @ts-ignore
    const nonWitnessUtxoTx = psbt.__NON_WITNESS_UTXO_TX_CACHE[inputIndex];

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
    let _script: Buffer; // so we don't shadow the `let script` above
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
      const signingScript = payments.p2pkh({ hash: _script.slice(2) }).output!;
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

type ScriptCheckerFunction = (idx: number, spk: Buffer, rs: Buffer) => void;

const scriptCheckerFactory = (
  payment: any,
  paymentScriptName: string,
): ScriptCheckerFunction => (
  inputIndex: number,
  scriptPubKey: Buffer,
  redeemScript: Buffer,
): void => {
  const redeemScriptOutput = payment({
    redeem: { output: redeemScript },
  }).output as Buffer;

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

type isPaymentFunction = (script: Buffer) => boolean;

const isPaymentFactory = (payment: any): isPaymentFunction => (
  script: Buffer,
): boolean => {
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

const classifyScript = (script: Buffer): string => {
  if (isP2WPKH(script)) return 'witnesspubkeyhash';
  if (isP2PKH(script)) return 'pubkeyhash';
  if (isP2MS(script)) return 'multisig';
  if (isP2PK(script)) return 'pubkey';
  return 'nonstandard';
};

interface GetScriptReturn {
  script: Buffer | null;
  isSegwit: boolean;
  isP2SH: boolean;
  isP2WSH: boolean;
}
function getScriptFromInput(
  inputIndex: number,
  input: PsbtInput,
  unsignedTx: Transaction,
  psbt: Psbt,
): GetScriptReturn {
  const res: GetScriptReturn = {
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
      // @ts-ignore
      if (!psbt.__NON_WITNESS_UTXO_TX_CACHE[inputIndex]) {
        addNonWitnessTxCache(psbt, input, inputIndex);
      }
      // @ts-ignore
      const nonWitnessUtxoTx = psbt.__NON_WITNESS_UTXO_TX_CACHE[inputIndex];
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
      }).output!;
    } else {
      res.script = payments.p2wpkh({
        hash: input.witnessUtxo.script.slice(2),
      }).output!;
    }
  }
  return res;
}

const hasSigs = (neededSigs: number, partialSig?: any[]): boolean => {
  if (!partialSig) return false;
  if (partialSig.length > neededSigs) throw new Error('Too many signatures');
  return partialSig.length === neededSigs;
};

function witnessStackToScriptWitness(witness: Buffer[]): Buffer {
  let buffer = Buffer.allocUnsafe(0);

  function writeSlice(slice: Buffer): void {
    buffer = Buffer.concat([buffer, Buffer.from(slice)]);
  }

  function writeVarInt(i: number): void {
    const currentLen = buffer.length;
    const varintLen = varuint.encodingLength(i);

    buffer = Buffer.concat([buffer, Buffer.allocUnsafe(varintLen)]);
    varuint.encode(i, buffer, currentLen);
  }

  function writeVarSlice(slice: Buffer): void {
    writeVarInt(slice.length);
    writeSlice(slice);
  }

  function writeVector(vector: Buffer[]): void {
    writeVarInt(vector.length);
    vector.forEach(writeVarSlice);
  }

  writeVector(witness);

  return buffer;
}

function scriptWitnessToWitnessStack(buffer: Buffer): Buffer[] {
  let offset = 0;

  function readSlice(n: number): Buffer {
    offset += n;
    return buffer.slice(offset - n, offset);
  }

  function readVarInt(): number {
    const vi = varuint.decode(buffer, offset);
    offset += varuint.decode.bytes;
    return vi;
  }

  function readVarSlice(): Buffer {
    return readSlice(readVarInt());
  }

  function readVector(): Buffer[] {
    const count = readVarInt();
    const vector: Buffer[] = [];
    for (let i = 0; i < count; i++) vector.push(readVarSlice());
    return vector;
  }

  return readVector();
}

const range = (n: number): number[] => [...Array(n).keys()];

function checkTxEmpty(tx: Transaction): void {
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

function checkInputsForPartialSig(inputs: PsbtInput[], action: string): void {
  inputs.forEach(input => {
    let throws = false;
    if ((input.partialSig || []).length > 0) {
      if (input.sighashType !== undefined) {
        const whitelist: string[] = [];
        const isAnyoneCanPay =
          input.sighashType & Transaction.SIGHASH_ANYONECANPAY;
        if (isAnyoneCanPay) whitelist.push('addInput');
        if (!isAnyoneCanPay && action === 'addInput') {
          throws = true;
        }
        const hashType = input.sighashType & 0x1f;
        switch (hashType) {
          case Transaction.SIGHASH_ALL:
            break;
          case Transaction.SIGHASH_SINGLE:
          case Transaction.SIGHASH_NONE:
            whitelist.push('addOutput');
            whitelist.push('setSequence');
            break;
        }
        if (whitelist.indexOf(action) === -1) {
          throws = true;
        }
      } else {
        throws = true;
      }
    }
    if (throws) {
      throw new Error('Can not modify transaction, signatures exist.');
    }
  });
}

function check32Bit(num: number): void {
  if (
    typeof num !== 'number' ||
    num !== Math.floor(num) ||
    num > 0xffffffff ||
    num < 0
  ) {
    throw new Error('Invalid 32 bit integer');
  }
}
