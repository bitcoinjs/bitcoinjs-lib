import { createPsbt } from 'bip174';
import * as bufferutils from './bufferutils';
import { reverseBuffer } from './bufferutils';
import * as bcrypto from './crypto';
import * as bscript from './script';
import { OPS as opcodes } from './script';
import * as types from './types';

const reverse = require('buffer-reverse');
const typeforce = require('typeforce');
const varuint = require('varuint-bitcoin');

function varSliceSize(someScript: Buffer): number {
  const length = someScript.length;

  return varuint.encodingLength(length) + length;
}

function vectorSize(someVector: Buffer[]): number {
  const length = someVector.length;

  return (
    varuint.encodingLength(length) +
    someVector.reduce((sum, witness) => {
      return sum + varSliceSize(witness);
    }, 0)
  );
}

const EMPTY_SCRIPT: Buffer = Buffer.allocUnsafe(0);
const EMPTY_WITNESS: Buffer[] = [];
const ZERO: Buffer = Buffer.from(
  '0000000000000000000000000000000000000000000000000000000000000000',
  'hex',
);
const ONE: Buffer = Buffer.from(
  '0000000000000000000000000000000000000000000000000000000000000001',
  'hex',
);
const VALUE_UINT64_MAX: Buffer = Buffer.from('ffffffffffffffff', 'hex');
const BLANK_OUTPUT: BlankOutput = {
  script: EMPTY_SCRIPT,
  valueBuffer: VALUE_UINT64_MAX,
};

function isOutput(out: Output | BlankOutput): out is Output {
  return (out as Output).value !== undefined;
}

export interface BlankOutput {
  script: Buffer;
  valueBuffer: Buffer;
}

export interface Output {
  script: Buffer;
  value: number;
}

type OpenOutput = Output | BlankOutput;

export interface Input {
  hash: Buffer;
  index: number;
  script: Buffer;
  sequence: number;
  witness: Buffer[];
}

export class Transaction {
  static readonly DEFAULT_SEQUENCE = 0xffffffff;
  static readonly SIGHASH_ALL = 0x01;
  static readonly SIGHASH_NONE = 0x02;
  static readonly SIGHASH_SINGLE = 0x03;
  static readonly SIGHASH_ANYONECANPAY = 0x80;
  static readonly ADVANCED_TRANSACTION_MARKER = 0x00;
  static readonly ADVANCED_TRANSACTION_FLAG = 0x01;

  static fromBuffer(buffer: Buffer, _NO_STRICT?: boolean): Transaction {
    let offset: number = 0;

    function readSlice(n: number): Buffer {
      offset += n;
      return buffer.slice(offset - n, offset);
    }

    function readUInt32(): number {
      const i = buffer.readUInt32LE(offset);
      offset += 4;
      return i;
    }

    function readInt32(): number {
      const i = buffer.readInt32LE(offset);
      offset += 4;
      return i;
    }

    function readUInt64(): number {
      const i = bufferutils.readUInt64LE(buffer, offset);
      offset += 8;
      return i;
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

    const tx = new Transaction();
    tx.version = readInt32();

    const marker = buffer.readUInt8(offset);
    const flag = buffer.readUInt8(offset + 1);

    let hasWitnesses = false;
    if (
      marker === Transaction.ADVANCED_TRANSACTION_MARKER &&
      flag === Transaction.ADVANCED_TRANSACTION_FLAG
    ) {
      offset += 2;
      hasWitnesses = true;
    }

    const vinLen = readVarInt();
    for (let i = 0; i < vinLen; ++i) {
      tx.ins.push({
        hash: readSlice(32),
        index: readUInt32(),
        script: readVarSlice(),
        sequence: readUInt32(),
        witness: EMPTY_WITNESS,
      });
    }

    const voutLen = readVarInt();
    for (let i = 0; i < voutLen; ++i) {
      tx.outs.push({
        value: readUInt64(),
        script: readVarSlice(),
      });
    }

    if (hasWitnesses) {
      for (let i = 0; i < vinLen; ++i) {
        tx.ins[i].witness = readVector();
      }

      // was this pointless?
      if (!tx.hasWitnesses())
        throw new Error('Transaction has superfluous witness data');
    }

    tx.locktime = readUInt32();

    if (_NO_STRICT) return tx;
    if (offset !== buffer.length)
      throw new Error('Transaction has unexpected data');

    return tx;
  }

  static fromHex(hex: string): Transaction {
    return Transaction.fromBuffer(Buffer.from(hex, 'hex'), false);
  }

  static isCoinbaseHash(buffer: Buffer): boolean {
    typeforce(types.Hash256bit, buffer);
    for (let i = 0; i < 32; ++i) {
      if (buffer[i] !== 0) return false;
    }
    return true;
  }

  version: number = 1;
  locktime: number = 0;
  ins: Input[] = [];
  outs: OpenOutput[] = [];

  isCoinbase(): boolean {
    return (
      this.ins.length === 1 && Transaction.isCoinbaseHash(this.ins[0].hash)
    );
  }

  addInput(
    hash: Buffer,
    index: number,
    sequence?: number,
    scriptSig?: Buffer,
  ): number {
    typeforce(
      types.tuple(
        types.Hash256bit,
        types.UInt32,
        types.maybe(types.UInt32),
        types.maybe(types.Buffer),
      ),
      arguments,
    );

    if (types.Null(sequence)) {
      sequence = Transaction.DEFAULT_SEQUENCE;
    }

    // Add the input and return the input's index
    return (
      this.ins.push({
        hash,
        index,
        script: scriptSig || EMPTY_SCRIPT,
        sequence: sequence as number,
        witness: EMPTY_WITNESS,
      }) - 1
    );
  }

  addOutput(scriptPubKey: Buffer, value: number): number {
    typeforce(types.tuple(types.Buffer, types.Satoshi), arguments);

    // Add the output and return the output's index
    return (
      this.outs.push({
        script: scriptPubKey,
        value,
      }) - 1
    );
  }

  hasWitnesses(): boolean {
    return this.ins.some(x => {
      return x.witness.length !== 0;
    });
  }

  weight(): number {
    const base = this.__byteLength(false);
    const total = this.__byteLength(true);
    return base * 3 + total;
  }

  virtualSize(): number {
    return Math.ceil(this.weight() / 4);
  }

  byteLength(): number {
    return this.__byteLength(true);
  }

  clone(): Transaction {
    const newTx = new Transaction();
    newTx.version = this.version;
    newTx.locktime = this.locktime;

    newTx.ins = this.ins.map(txIn => {
      return {
        hash: txIn.hash,
        index: txIn.index,
        script: txIn.script,
        sequence: txIn.sequence,
        witness: txIn.witness,
      };
    });

    newTx.outs = this.outs.map(txOut => {
      return {
        script: txOut.script,
        value: (txOut as Output).value,
      };
    });

    return newTx;
  }

  /**
   * Hash transaction for signing a specific input.
   *
   * Bitcoin uses a different hash for each signed transaction input.
   * This method copies the transaction, makes the necessary changes based on the
   * hashType, and then hashes the result.
   * This hash can then be used to sign the provided transaction input.
   */
  hashForSignature(
    inIndex: number,
    prevOutScript: Buffer,
    hashType: number,
  ): Buffer {
    typeforce(
      types.tuple(types.UInt32, types.Buffer, /* types.UInt8 */ types.Number),
      arguments,
    );

    // https://github.com/bitcoin/bitcoin/blob/master/src/test/sighash_tests.cpp#L29
    if (inIndex >= this.ins.length) return ONE;

    // ignore OP_CODESEPARATOR
    const ourScript = bscript.compile(
      bscript.decompile(prevOutScript)!.filter(x => {
        return x !== opcodes.OP_CODESEPARATOR;
      }),
    );

    const txTmp = this.clone();

    // SIGHASH_NONE: ignore all outputs? (wildcard payee)
    if ((hashType & 0x1f) === Transaction.SIGHASH_NONE) {
      txTmp.outs = [];

      // ignore sequence numbers (except at inIndex)
      txTmp.ins.forEach((input, i) => {
        if (i === inIndex) return;

        input.sequence = 0;
      });

      // SIGHASH_SINGLE: ignore all outputs, except at the same index?
    } else if ((hashType & 0x1f) === Transaction.SIGHASH_SINGLE) {
      // https://github.com/bitcoin/bitcoin/blob/master/src/test/sighash_tests.cpp#L60
      if (inIndex >= this.outs.length) return ONE;

      // truncate outputs after
      txTmp.outs.length = inIndex + 1;

      // "blank" outputs before
      for (let i = 0; i < inIndex; i++) {
        txTmp.outs[i] = BLANK_OUTPUT;
      }

      // ignore sequence numbers (except at inIndex)
      txTmp.ins.forEach((input, y) => {
        if (y === inIndex) return;

        input.sequence = 0;
      });
    }

    // SIGHASH_ANYONECANPAY: ignore inputs entirely?
    if (hashType & Transaction.SIGHASH_ANYONECANPAY) {
      txTmp.ins = [txTmp.ins[inIndex]];
      txTmp.ins[0].script = ourScript;

      // SIGHASH_ALL: only ignore input scripts
    } else {
      // "blank" others input scripts
      txTmp.ins.forEach(input => {
        input.script = EMPTY_SCRIPT;
      });
      txTmp.ins[inIndex].script = ourScript;
    }

    // serialize and hash
    const buffer: Buffer = Buffer.allocUnsafe(txTmp.__byteLength(false) + 4);
    buffer.writeInt32LE(hashType, buffer.length - 4);
    txTmp.__toBuffer(buffer, 0, false);

    return bcrypto.hash256(buffer);
  }

  hashForWitnessV0(
    inIndex: number,
    prevOutScript: Buffer,
    value: number,
    hashType: number,
  ): Buffer {
    typeforce(
      types.tuple(types.UInt32, types.Buffer, types.Satoshi, types.UInt32),
      arguments,
    );

    let tbuffer: Buffer = Buffer.from([]);
    let toffset: number = 0;

    function writeSlice(slice: Buffer): void {
      toffset += slice.copy(tbuffer, toffset);
    }

    function writeUInt32(i: number): void {
      toffset = tbuffer.writeUInt32LE(i, toffset);
    }

    function writeUInt64(i: number): void {
      toffset = bufferutils.writeUInt64LE(tbuffer, i, toffset);
    }

    function writeVarInt(i: number): void {
      varuint.encode(i, tbuffer, toffset);
      toffset += varuint.encode.bytes;
    }

    function writeVarSlice(slice: Buffer): void {
      writeVarInt(slice.length);
      writeSlice(slice);
    }

    let hashOutputs = ZERO;
    let hashPrevouts = ZERO;
    let hashSequence = ZERO;

    if (!(hashType & Transaction.SIGHASH_ANYONECANPAY)) {
      tbuffer = Buffer.allocUnsafe(36 * this.ins.length);
      toffset = 0;

      this.ins.forEach(txIn => {
        writeSlice(txIn.hash);
        writeUInt32(txIn.index);
      });

      hashPrevouts = bcrypto.hash256(tbuffer);
    }

    if (
      !(hashType & Transaction.SIGHASH_ANYONECANPAY) &&
      (hashType & 0x1f) !== Transaction.SIGHASH_SINGLE &&
      (hashType & 0x1f) !== Transaction.SIGHASH_NONE
    ) {
      tbuffer = Buffer.allocUnsafe(4 * this.ins.length);
      toffset = 0;

      this.ins.forEach(txIn => {
        writeUInt32(txIn.sequence);
      });

      hashSequence = bcrypto.hash256(tbuffer);
    }

    if (
      (hashType & 0x1f) !== Transaction.SIGHASH_SINGLE &&
      (hashType & 0x1f) !== Transaction.SIGHASH_NONE
    ) {
      const txOutsSize = this.outs.reduce((sum, output) => {
        return sum + 8 + varSliceSize(output.script);
      }, 0);

      tbuffer = Buffer.allocUnsafe(txOutsSize);
      toffset = 0;

      this.outs.forEach(out => {
        writeUInt64((out as Output).value);
        writeVarSlice(out.script);
      });

      hashOutputs = bcrypto.hash256(tbuffer);
    } else if (
      (hashType & 0x1f) === Transaction.SIGHASH_SINGLE &&
      inIndex < this.outs.length
    ) {
      const output = this.outs[inIndex];

      tbuffer = Buffer.allocUnsafe(8 + varSliceSize(output.script));
      toffset = 0;
      writeUInt64((output as Output).value);
      writeVarSlice(output.script);

      hashOutputs = bcrypto.hash256(tbuffer);
    }

    tbuffer = Buffer.allocUnsafe(156 + varSliceSize(prevOutScript));
    toffset = 0;

    const input = this.ins[inIndex];
    writeUInt32(this.version);
    writeSlice(hashPrevouts);
    writeSlice(hashSequence);
    writeSlice(input.hash);
    writeUInt32(input.index);
    writeVarSlice(prevOutScript);
    writeUInt64(value);
    writeUInt32(input.sequence);
    writeSlice(hashOutputs);
    writeUInt32(this.locktime);
    writeUInt32(hashType);
    return bcrypto.hash256(tbuffer);
  }

  getHash(forWitness?: boolean): Buffer {
    // wtxid for coinbase is always 32 bytes of 0x00
    if (forWitness && this.isCoinbase()) return Buffer.alloc(32, 0);
    return bcrypto.hash256(this.__toBuffer(undefined, undefined, forWitness));
  }

  getId(): string {
    // transaction hash's are displayed in reverse order
    return reverseBuffer(this.getHash(false)).toString('hex');
  }

  toBuffer(buffer?: Buffer, initialOffset?: number): Buffer {
    return this.__toBuffer(buffer, initialOffset, true);
  }

  toHex(): string {
    return this.toBuffer(undefined, undefined).toString('hex');
  }

  toPsbtString(): string {
    const outputs = this.outs.map(output => ({
      script: output.script.toString('hex'),
      tokens: (output as Output).value,
    }));

    const utxos = this.ins.map(input => ({
      id: reverse(input.hash).toString('hex'),
      vout: input.index,
      sequence: input.sequence,
    }));

    const timelock = this.locktime;
    const { version } = this;

    const { psbt } = createPsbt({
      outputs,
      utxos,
      timelock,
      version,
    });

    // TODO: Add signature data to PSBT

    // TODO: Merge with imported PSBT if exists so we don't lose data

    return Buffer.from(psbt, 'hex').toString('base64');
  }

  setInputScript(index: number, scriptSig: Buffer): void {
    typeforce(types.tuple(types.Number, types.Buffer), arguments);

    this.ins[index].script = scriptSig;
  }

  setWitness(index: number, witness: Buffer[]): void {
    typeforce(types.tuple(types.Number, [types.Buffer]), arguments);

    this.ins[index].witness = witness;
  }

  private __byteLength(_ALLOW_WITNESS: boolean): number {
    const hasWitnesses = _ALLOW_WITNESS && this.hasWitnesses();

    return (
      (hasWitnesses ? 10 : 8) +
      varuint.encodingLength(this.ins.length) +
      varuint.encodingLength(this.outs.length) +
      this.ins.reduce((sum, input) => {
        return sum + 40 + varSliceSize(input.script);
      }, 0) +
      this.outs.reduce((sum, output) => {
        return sum + 8 + varSliceSize(output.script);
      }, 0) +
      (hasWitnesses
        ? this.ins.reduce((sum, input) => {
            return sum + vectorSize(input.witness);
          }, 0)
        : 0)
    );
  }

  private __toBuffer(
    buffer?: Buffer,
    initialOffset?: number,
    _ALLOW_WITNESS?: boolean,
  ): Buffer {
    if (!buffer)
      buffer = Buffer.allocUnsafe(this.__byteLength(_ALLOW_WITNESS!)) as Buffer;

    let offset = initialOffset || 0;

    function writeSlice(slice: Buffer): void {
      offset += slice.copy(buffer!, offset);
    }

    function writeUInt8(i: number): void {
      offset = buffer!.writeUInt8(i, offset);
    }

    function writeUInt32(i: number): void {
      offset = buffer!.writeUInt32LE(i, offset);
    }

    function writeInt32(i: number): void {
      offset = buffer!.writeInt32LE(i, offset);
    }

    function writeUInt64(i: number): void {
      offset = bufferutils.writeUInt64LE(buffer!, i, offset);
    }

    function writeVarInt(i: number): void {
      varuint.encode(i, buffer, offset);
      offset += varuint.encode.bytes;
    }

    function writeVarSlice(slice: Buffer): void {
      writeVarInt(slice.length);
      writeSlice(slice);
    }

    function writeVector(vector: Buffer[]): void {
      writeVarInt(vector.length);
      vector.forEach(writeVarSlice);
    }

    writeInt32(this.version);

    const hasWitnesses = _ALLOW_WITNESS && this.hasWitnesses();

    if (hasWitnesses) {
      writeUInt8(Transaction.ADVANCED_TRANSACTION_MARKER);
      writeUInt8(Transaction.ADVANCED_TRANSACTION_FLAG);
    }

    writeVarInt(this.ins.length);

    this.ins.forEach(txIn => {
      writeSlice(txIn.hash);
      writeUInt32(txIn.index);
      writeVarSlice(txIn.script);
      writeUInt32(txIn.sequence);
    });

    writeVarInt(this.outs.length);
    this.outs.forEach(txOut => {
      if (isOutput(txOut)) {
        writeUInt64(txOut.value);
      } else {
        writeSlice(txOut.valueBuffer);
      }

      writeVarSlice(txOut.script);
    });

    if (hasWitnesses) {
      this.ins.forEach(input => {
        writeVector(input.witness);
      });
    }

    writeUInt32(this.locktime);

    // avoid slicing unless necessary
    if (initialOffset !== undefined) return buffer.slice(initialOffset, offset);
    return buffer;
  }
}
