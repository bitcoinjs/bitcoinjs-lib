import { Psbt as PsbtBase } from 'bip174';
import * as varuint from 'bip174/src/lib/converter/varint';
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
import {
  fromPublicKey as ecPairFromPublicKey,
  Signer,
  SignerAsync,
} from './ecpair';
import { bitcoin as btcNetwork, Network } from './networks';
import * as payments from './payments';
import * as bscript from './script';
import { Output, Transaction } from './transaction';

const DEFAULT_OPTS: PsbtOpts = {
  network: btcNetwork,
  maximumFeeRate: 5000, // satoshi per byte
};

export class Psbt extends PsbtBase {
  static fromTransaction<T extends typeof PsbtBase>(
    this: T,
    txBuf: Buffer,
  ): InstanceType<T> {
    const tx = Transaction.fromBuffer(txBuf);
    checkTxEmpty(tx);
    const psbt = new this() as Psbt;
    psbt.__CACHE.__TX = tx;
    checkTxForDupeIns(tx, psbt.__CACHE);
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
    psbt.__CACHE.__TX = tx!;
    checkTxForDupeIns(tx!, psbt.__CACHE);
    return psbt as InstanceType<T>;
  }

  private __CACHE: PsbtCache = {
    __NON_WITNESS_UTXO_TX_CACHE: [],
    __NON_WITNESS_UTXO_BUF_CACHE: [],
    __TX_IN_CACHE: {},
    __TX: new Transaction(),
  };
  private opts: PsbtOpts;

  constructor(opts: PsbtOptsOptional = {}) {
    super();
    // set defaults
    this.opts = Object.assign({}, DEFAULT_OPTS, opts);
    const c = this.__CACHE;
    c.__TX = Transaction.fromBuffer(this.globalMap.unsignedTx!);
    this.setVersion(2);

    // set cache
    delete this.globalMap.unsignedTx;
    Object.defineProperty(this.globalMap, 'unsignedTx', {
      enumerable: true,
      get(): Buffer {
        const buf = c.__TX_BUF_CACHE;
        if (buf !== undefined) {
          return buf;
        } else {
          c.__TX_BUF_CACHE = c.__TX.toBuffer();
          return c.__TX_BUF_CACHE;
        }
      },
      set(data: Buffer): void {
        c.__TX_BUF_CACHE = data;
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
    dpew(this, '__CACHE', false, true);
    dpew(this, 'opts', false, true);
  }

  get inputCount(): number {
    return this.inputs.length;
  }

  setMaximumFeeRate(satoshiPerByte: number): void {
    check32Bit(satoshiPerByte); // 42.9 BTC per byte IS excessive... so throw
    this.opts.maximumFeeRate = satoshiPerByte;
  }

  setVersion(version: number): this {
    check32Bit(version);
    checkInputsForPartialSig(this.inputs, 'setVersion');
    const c = this.__CACHE;
    c.__TX.version = version;
    c.__TX_BUF_CACHE = undefined;
    c.__EXTRACTED_TX = undefined;
    return this;
  }

  setLocktime(locktime: number): this {
    check32Bit(locktime);
    checkInputsForPartialSig(this.inputs, 'setLocktime');
    const c = this.__CACHE;
    c.__TX.locktime = locktime;
    c.__TX_BUF_CACHE = undefined;
    c.__EXTRACTED_TX = undefined;
    return this;
  }

  setSequence(inputIndex: number, sequence: number): this {
    check32Bit(sequence);
    checkInputsForPartialSig(this.inputs, 'setSequence');
    const c = this.__CACHE;
    if (c.__TX.ins.length <= inputIndex) {
      throw new Error('Input index too high');
    }
    c.__TX.ins[inputIndex].sequence = sequence;
    c.__TX_BUF_CACHE = undefined;
    c.__EXTRACTED_TX = undefined;
    return this;
  }

  addInput(inputData: TransactionInput): this {
    checkInputsForPartialSig(this.inputs, 'addInput');
    const c = this.__CACHE;
    const inputAdder = getInputAdder(c);
    super.addInput(inputData, inputAdder);
    c.__FEE_RATE = undefined;
    c.__EXTRACTED_TX = undefined;
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
    const c = this.__CACHE;
    const outputAdder = getOutputAdder(c);
    super.addOutput(outputData, true, outputAdder);
    c.__FEE_RATE = undefined;
    c.__EXTRACTED_TX = undefined;
    return this;
  }

  addNonWitnessUtxoToInput(
    inputIndex: number,
    nonWitnessUtxo: NonWitnessUtxo,
  ): this {
    super.addNonWitnessUtxoToInput(inputIndex, nonWitnessUtxo);
    const input = this.inputs[inputIndex];
    addNonWitnessTxCache(this.__CACHE, input, inputIndex);
    return this;
  }

  extractTransaction(disableFeeCheck?: boolean): Transaction {
    if (!this.inputs.every(isFinalized)) throw new Error('Not finalized');
    const c = this.__CACHE;
    if (!disableFeeCheck) {
      checkFees(this, c, this.opts);
    }
    if (c.__EXTRACTED_TX) return c.__EXTRACTED_TX;
    const tx = c.__TX.clone();
    inputFinalizeGetAmts(this.inputs, tx, c, true);
    return tx;
  }

  getFeeRate(): number {
    if (!this.inputs.every(isFinalized))
      throw new Error('PSBT must be finalized to calculate fee rate');
    const c = this.__CACHE;
    if (c.__FEE_RATE) return c.__FEE_RATE;
    let tx: Transaction;
    let mustFinalize = true;
    if (c.__EXTRACTED_TX) {
      tx = c.__EXTRACTED_TX;
      mustFinalize = false;
    } else {
      tx = c.__TX.clone();
    }
    inputFinalizeGetAmts(this.inputs, tx, c, mustFinalize);
    return c.__FEE_RATE!;
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
      this.__CACHE,
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

  validateSignatures(inputIndex: number, pubkey?: Buffer): boolean {
    const input = this.inputs[inputIndex];
    const partialSig = (input || {}).partialSig;
    if (!input || !partialSig || partialSig.length < 1)
      throw new Error('No signatures to validate');
    const mySigs = pubkey
      ? partialSig.filter(sig => sig.pubkey.equals(pubkey))
      : partialSig;
    if (mySigs.length < 1) throw new Error('No signatures for this pubkey');
    const results: boolean[] = [];
    let hashCache: Buffer;
    let scriptCache: Buffer;
    let sighashCache: number;
    for (const pSig of mySigs) {
      const sig = bscript.signature.decode(pSig.signature);
      const { hash, script } =
        sighashCache! !== sig.hashType
          ? getHashForSig(
              inputIndex,
              Object.assign({}, input, { sighashType: sig.hashType }),
              this.__CACHE,
            )
          : { hash: hashCache!, script: scriptCache! };
      sighashCache = sig.hashType;
      hashCache = hash;
      scriptCache = script;
      checkScriptForPubkey(pSig.pubkey, script, 'verify');
      const keypair = ecPairFromPublicKey(pSig.pubkey);
      results.push(keypair.verify(hash, sig.signature));
    }
    return results.every(res => res === true);
  }

  sign(keyPair: Signer): this {
    if (!keyPair || !keyPair.publicKey)
      throw new Error('Need Signer to sign input');

    // TODO: Add a pubkey/pubkeyhash cache to each input
    // as input information is added, then eventually
    // optimize this method.
    const results: boolean[] = [];
    for (const [i] of this.inputs.entries()) {
      try {
        this.signInput(i, keyPair);
        results.push(true);
      } catch (err) {
        results.push(false);
      }
    }
    if (results.every(v => v === false)) {
      throw new Error('No inputs were signed');
    }
    return this;
  }

  signAsync(keyPair: SignerAsync): Promise<void> {
    return new Promise(
      (resolve, reject): any => {
        if (!keyPair || !keyPair.publicKey)
          return reject(new Error('Need Signer to sign input'));

        // TODO: Add a pubkey/pubkeyhash cache to each input
        // as input information is added, then eventually
        // optimize this method.
        const results: boolean[] = [];
        const promises: Array<Promise<void>> = [];
        for (const [i] of this.inputs.entries()) {
          promises.push(
            this.signInputAsync(i, keyPair).then(
              () => {
                results.push(true);
              },
              () => {
                results.push(false);
              },
            ),
          );
        }
        return Promise.all(promises).then(() => {
          if (results.every(v => v === false)) {
            return reject(new Error('No inputs were signed'));
          }
          resolve();
        });
      },
    );
  }

  signInput(inputIndex: number, keyPair: Signer): this {
    if (!keyPair || !keyPair.publicKey)
      throw new Error('Need Signer to sign input');
    const { hash, sighashType } = getHashAndSighashType(
      this.inputs,
      inputIndex,
      keyPair.publicKey,
      this.__CACHE,
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
          this.__CACHE,
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

interface PsbtCache {
  __NON_WITNESS_UTXO_TX_CACHE: Transaction[];
  __NON_WITNESS_UTXO_BUF_CACHE: Buffer[];
  __TX_IN_CACHE: { [index: string]: number };
  __TX: Transaction;
  __TX_BUF_CACHE?: Buffer;
  __FEE_RATE?: number;
  __EXTRACTED_TX?: Transaction;
}

interface PsbtOptsOptional {
  network?: Network;
  maximumFeeRate?: number;
}

interface PsbtOpts {
  network: Network;
  maximumFeeRate: number;
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

function hasSigs(neededSigs: number, partialSig?: any[]): boolean {
  if (!partialSig) return false;
  if (partialSig.length > neededSigs) throw new Error('Too many signatures');
  return partialSig.length === neededSigs;
}

function isFinalized(input: PsbtInput): boolean {
  return !!input.finalScriptSig || !!input.finalScriptWitness;
}

function isPaymentFactory(payment: any): (script: Buffer) => boolean {
  return (script: Buffer): boolean => {
    try {
      payment({ output: script });
      return true;
    } catch (err) {
      return false;
    }
  };
}
const isP2MS = isPaymentFactory(payments.p2ms);
const isP2PK = isPaymentFactory(payments.p2pk);
const isP2PKH = isPaymentFactory(payments.p2pkh);
const isP2WPKH = isPaymentFactory(payments.p2wpkh);

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

function checkFees(psbt: Psbt, cache: PsbtCache, opts: PsbtOpts): void {
  const feeRate = cache.__FEE_RATE || psbt.getFeeRate();
  const vsize = cache.__EXTRACTED_TX!.virtualSize();
  const satoshis = feeRate * vsize;
  if (feeRate >= opts.maximumFeeRate) {
    throw new Error(
      `Warning: You are paying around ${(satoshis / 1e8).toFixed(8)} in ` +
        `fees, which is ${feeRate} satoshi per byte for a transaction ` +
        `with a VSize of ${vsize} bytes (segwit counted as 0.25 byte per ` +
        `byte). Use setMaximumFeeRate method to raise your threshold, or ` +
        `pass true to the first arg of extractTransaction.`,
    );
  }
}

function checkInputsForPartialSig(inputs: PsbtInput[], action: string): void {
  inputs.forEach(input => {
    let throws = false;
    if ((input.partialSig || []).length === 0) return;
    input.partialSig!.forEach(pSig => {
      const { hashType } = bscript.signature.decode(pSig.signature);
      const whitelist: string[] = [];
      const isAnyoneCanPay = hashType & Transaction.SIGHASH_ANYONECANPAY;
      if (isAnyoneCanPay) whitelist.push('addInput');
      const hashMod = hashType & 0x1f;
      switch (hashMod) {
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
    });
    if (throws) {
      throw new Error('Can not modify transaction, signatures exist.');
    }
  });
}

function checkScriptForPubkey(
  pubkey: Buffer,
  script: Buffer,
  action: string,
): void {
  const pubkeyHash = hash160(pubkey);

  const decompiled = bscript.decompile(script);
  if (decompiled === null) throw new Error('Unknown script error');

  const hasKey = decompiled.some(element => {
    if (typeof element === 'number') return false;
    return element.equals(pubkey) || element.equals(pubkeyHash);
  });

  if (!hasKey) {
    throw new Error(
      `Can not ${action} for this input with the key ${pubkey.toString('hex')}`,
    );
  }
}

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

function checkTxForDupeIns(tx: Transaction, cache: PsbtCache): void {
  tx.ins.forEach(input => {
    checkTxInputCache(cache, input);
  });
}

function checkTxInputCache(
  cache: PsbtCache,
  input: { hash: Buffer; index: number },
): void {
  const key =
    reverseBuffer(Buffer.from(input.hash)).toString('hex') + ':' + input.index;
  if (cache.__TX_IN_CACHE[key]) throw new Error('Duplicate input detected.');
  cache.__TX_IN_CACHE[key] = 1;
}

function scriptCheckerFactory(
  payment: any,
  paymentScriptName: string,
): (idx: number, spk: Buffer, rs: Buffer) => void {
  return (
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
}
const checkRedeemScript = scriptCheckerFactory(payments.p2sh, 'Redeem script');
const checkWitnessScript = scriptCheckerFactory(
  payments.p2wsh,
  'Witness script',
);

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

function getHashAndSighashType(
  inputs: PsbtInput[],
  inputIndex: number,
  pubkey: Buffer,
  cache: PsbtCache,
): {
  hash: Buffer;
  sighashType: number;
} {
  const input = checkForInput(inputs, inputIndex);
  const { hash, sighashType, script } = getHashForSig(inputIndex, input, cache);
  checkScriptForPubkey(pubkey, script, 'sign');
  return {
    hash,
    sighashType,
  };
}

function getHashForSig(
  inputIndex: number,
  input: PsbtInput,
  cache: PsbtCache,
): {
  script: Buffer;
  hash: Buffer;
  sighashType: number;
} {
  const unsignedTx = cache.__TX;
  const sighashType = input.sighashType || Transaction.SIGHASH_ALL;
  let hash: Buffer;
  let script: Buffer;

  if (input.nonWitnessUtxo) {
    const nonWitnessUtxoTx = nonWitnessUtxoTxFromCache(
      cache,
      input,
      inputIndex,
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
}

function getInputAdder(
  cache: PsbtCache,
): (_inputData: TransactionInput, txBuf: Buffer) => Buffer {
  const selfCache = cache;
  return (_inputData: TransactionInput, txBuf: Buffer): Buffer => {
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

    // Check if input already exists in cache.
    const input = { hash: prevHash, index: _inputData.index };
    checkTxInputCache(selfCache, input);

    selfCache.__TX.ins.push({
      ...input,
      script: Buffer.alloc(0),
      sequence: _inputData.sequence || Transaction.DEFAULT_SEQUENCE,
      witness: [],
    });
    return selfCache.__TX.toBuffer();
  };
}

function getOutputAdder(
  cache: PsbtCache,
): (_outputData: TransactionOutput, txBuf: Buffer) => Buffer {
  const selfCache = cache;
  return (_outputData: TransactionOutput, txBuf: Buffer): Buffer => {
    if (
      !txBuf ||
      (_outputData as any).script === undefined ||
      (_outputData as any).value === undefined ||
      !Buffer.isBuffer((_outputData as any).script) ||
      typeof (_outputData as any).value !== 'number'
    ) {
      throw new Error('Error adding output.');
    }
    selfCache.__TX.outs.push({
      script: (_outputData as any).script!,
      value: _outputData.value,
    });
    return selfCache.__TX.toBuffer();
  };
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

interface GetScriptReturn {
  script: Buffer | null;
  isSegwit: boolean;
  isP2SH: boolean;
  isP2WSH: boolean;
}
function getScriptFromInput(
  inputIndex: number,
  input: PsbtInput,
  cache: PsbtCache,
): GetScriptReturn {
  const unsignedTx = cache.__TX;
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
      const nonWitnessUtxoTx = nonWitnessUtxoTxFromCache(
        cache,
        input,
        inputIndex,
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
      }).output!;
    } else {
      res.script = payments.p2wpkh({
        hash: input.witnessUtxo.script.slice(2),
      }).output!;
    }
  }
  return res;
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

function scriptWitnessToWitnessStack(buffer: Buffer): Buffer[] {
  let offset = 0;

  function readSlice(n: number): Buffer {
    offset += n;
    return buffer.slice(offset - n, offset);
  }

  function readVarInt(): number {
    const vi = varuint.decode(buffer, offset);
    offset += (varuint.decode as any).bytes;
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

function addNonWitnessTxCache(
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

function inputFinalizeGetAmts(
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
  cache.__EXTRACTED_TX = tx;
  cache.__FEE_RATE = Math.floor(fee / bytes);
}

function nonWitnessUtxoTxFromCache(
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

function classifyScript(script: Buffer): string {
  if (isP2WPKH(script)) return 'witnesspubkeyhash';
  if (isP2PKH(script)) return 'pubkeyhash';
  if (isP2MS(script)) return 'multisig';
  if (isP2PK(script)) return 'pubkey';
  return 'nonstandard';
}

function range(n: number): number[] {
  return [...Array(n).keys()];
}
