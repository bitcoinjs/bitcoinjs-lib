'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const bufferutils_1 = require('./bufferutils');
const bcrypto = require('./crypto');
const bscript = require('./script');
const script_1 = require('./script');
const types = require('./types');
const typeforce = require('typeforce');
const varuint = require('varuint-bitcoin');
function varSliceSize(someScript) {
  const length = someScript.length;
  return varuint.encodingLength(length) + length;
}
function vectorSize(someVector) {
  const length = someVector.length;
  return (
    varuint.encodingLength(length) +
    someVector.reduce((sum, witness) => {
      return sum + varSliceSize(witness);
    }, 0)
  );
}
const EMPTY_SCRIPT = Buffer.allocUnsafe(0);
const EMPTY_WITNESS = [];
const ZERO = Buffer.from(
  '0000000000000000000000000000000000000000000000000000000000000000',
  'hex',
);
const ONE = Buffer.from(
  '0000000000000000000000000000000000000000000000000000000000000001',
  'hex',
);
const VALUE_UINT64_MAX = Buffer.from('ffffffffffffffff', 'hex');
const BLANK_OUTPUT = {
  script: EMPTY_SCRIPT,
  valueBuffer: VALUE_UINT64_MAX,
};
function isOutput(out) {
  return out.value !== undefined;
}
class Transaction {
  constructor() {
    this.version = 1;
    this.locktime = 0;
    this.ins = [];
    this.outs = [];
    this.persentBlockHash = null;
  }
  static fromBuffer(buffer, _NO_STRICT) {
    const bufferReader = new bufferutils_1.BufferReader(buffer);
    const tx = new Transaction();
    tx.version = bufferReader.readInt32();
    if (tx.version === 12) {
      tx.persentBlockHash = readSlice(32)
    }
    const marker = bufferReader.readUInt8();
    const flag = bufferReader.readUInt8();
    let hasWitnesses = false;
    if (
      marker === Transaction.ADVANCED_TRANSACTION_MARKER &&
      flag === Transaction.ADVANCED_TRANSACTION_FLAG
    ) {
      hasWitnesses = true;
    } else {
      bufferReader.offset -= 2;
    }
    const vinLen = bufferReader.readVarInt();
    for (let i = 0; i < vinLen; ++i) {
      tx.ins.push({
        hash: bufferReader.readSlice(32),
        index: bufferReader.readUInt32(),
        script: bufferReader.readVarSlice(),
        sequence: bufferReader.readUInt32(),
        witness: EMPTY_WITNESS,
      });
    }
    const voutLen = bufferReader.readVarInt();
    for (let i = 0; i < voutLen; ++i) {
      tx.outs.push({
        value: bufferReader.readUInt64(),
        script: bufferReader.readVarSlice(),
      });
    }
    if (hasWitnesses) {
      for (let i = 0; i < vinLen; ++i) {
        tx.ins[i].witness = bufferReader.readVector();
      }
      // was this pointless?
      if (!tx.hasWitnesses())
        throw new Error('Transaction has superfluous witness data');
    }
    tx.locktime = bufferReader.readUInt32();
    if (_NO_STRICT) return tx;
    if (bufferReader.offset !== buffer.length)
      throw new Error('Transaction has unexpected data');
    return tx;
  }
  static fromHex(hex) {
    return Transaction.fromBuffer(Buffer.from(hex, 'hex'), false);
  }
  static isCoinbaseHash(buffer) {
    typeforce(types.Hash256bit, buffer);
    for (let i = 0; i < 32; ++i) {
      if (buffer[i] !== 0) return false;
    }
    return true;
  }
  isCoinbase() {
    return (
      this.ins.length === 1 && Transaction.isCoinbaseHash(this.ins[0].hash)
    );
  }
  addInput(hash, index, sequence, scriptSig) {
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
        sequence: sequence,
        witness: EMPTY_WITNESS,
      }) - 1
    );
  }
  addOutput(scriptPubKey, value) {
    typeforce(types.tuple(types.Buffer, types.Satoshi), arguments);
    // Add the output and return the output's index
    return (
      this.outs.push({
        script: scriptPubKey,
        value,
      }) - 1
    );
  }
  hasWitnesses() {
    return this.ins.some(x => {
      return x.witness.length !== 0;
    });
  }
  weight() {
    const base = this.byteLength(false);
    const total = this.byteLength(true);
    return base * 3 + total;
  }
  virtualSize() {
    return Math.ceil(this.weight() / 4);
  }
  byteLength(_ALLOW_WITNESS = true) {
    const hasWitnesses = _ALLOW_WITNESS && this.hasWitnesses();
    const hasPreBlockHash = ((this.version === 12) && (this.persentBlockHash != null))

    return (
      (hasWitnesses ? 10 : 8) +
      (hasPreBlockHash ? 32 : 0) +
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
  clone() {
    const newTx = new Transaction();
    newTx.version = this.version;
    if (this.version === 12) {
      newTx.persentBlockHash = this.persentBlockHash
    }
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
        value: txOut.value,
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
  hashForSignature(inIndex, prevOutScript, hashType) {
    typeforce(
      types.tuple(types.UInt32, types.Buffer, /* types.UInt8 */ types.Number),
      arguments,
    );
    // https://github.com/bitcoin/bitcoin/blob/master/src/test/sighash_tests.cpp#L29
    if (inIndex >= this.ins.length) return ONE;
    // ignore OP_CODESEPARATOR
    const ourScript = bscript.compile(
      bscript.decompile(prevOutScript).filter(x => {
        return x !== script_1.OPS.OP_CODESEPARATOR;
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
    const buffer = Buffer.allocUnsafe(txTmp.byteLength(false) + 4);
    buffer.writeInt32LE(hashType, buffer.length - 4);
    txTmp.__toBuffer(buffer, 0, false);
    return bcrypto.hash256(buffer);
  }
  hashForWitnessV0(inIndex, prevOutScript, value, hashType) {
    typeforce(
      types.tuple(types.UInt32, types.Buffer, types.Satoshi, types.UInt32),
      arguments,
    );
    let tbuffer = Buffer.from([]);
    let bufferWriter;
    let hashOutputs = ZERO;
    let hashPrevouts = ZERO;
    let hashSequence = ZERO;
    if (!(hashType & Transaction.SIGHASH_ANYONECANPAY)) {
      tbuffer = Buffer.allocUnsafe(36 * this.ins.length);
      bufferWriter = new bufferutils_1.BufferWriter(tbuffer, 0);
      this.ins.forEach(txIn => {
        bufferWriter.writeSlice(txIn.hash);
        bufferWriter.writeUInt32(txIn.index);
      });
      hashPrevouts = bcrypto.hash256(tbuffer);
    }
    if (
      !(hashType & Transaction.SIGHASH_ANYONECANPAY) &&
      (hashType & 0x1f) !== Transaction.SIGHASH_SINGLE &&
      (hashType & 0x1f) !== Transaction.SIGHASH_NONE
    ) {
      tbuffer = Buffer.allocUnsafe(4 * this.ins.length);
      bufferWriter = new bufferutils_1.BufferWriter(tbuffer, 0);
      this.ins.forEach(txIn => {
        bufferWriter.writeUInt32(txIn.sequence);
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
      bufferWriter = new bufferutils_1.BufferWriter(tbuffer, 0);
      this.outs.forEach(out => {
        bufferWriter.writeUInt64(out.value);
        bufferWriter.writeVarSlice(out.script);
      });
      hashOutputs = bcrypto.hash256(tbuffer);
    } else if (
      (hashType & 0x1f) === Transaction.SIGHASH_SINGLE &&
      inIndex < this.outs.length
    ) {
      const output = this.outs[inIndex];
      tbuffer = Buffer.allocUnsafe(8 + varSliceSize(output.script));
      bufferWriter = new bufferutils_1.BufferWriter(tbuffer, 0);
      bufferWriter.writeUInt64(output.value);
      bufferWriter.writeVarSlice(output.script);
      hashOutputs = bcrypto.hash256(tbuffer);
    }
    tbuffer = Buffer.allocUnsafe(156 + varSliceSize(prevOutScript));
    bufferWriter = new bufferutils_1.BufferWriter(tbuffer, 0);
    const input = this.ins[inIndex];
    bufferWriter.writeUInt32(this.version);
    if (this.version === 12) {
      bufferWriter.writeSlice(this.persentBlockHash)
    }
    bufferWriter.writeSlice(hashPrevouts);
    bufferWriter.writeSlice(hashSequence);
    bufferWriter.writeSlice(input.hash);
    bufferWriter.writeUInt32(input.index);
    bufferWriter.writeVarSlice(prevOutScript);
    bufferWriter.writeUInt64(value);
    bufferWriter.writeUInt32(input.sequence);
    bufferWriter.writeSlice(hashOutputs);
    bufferWriter.writeUInt32(this.locktime);
    bufferWriter.writeUInt32(hashType);
    return bcrypto.hash256(tbuffer);
  }
  getHash(forWitness) {
    // wtxid for coinbase is always 32 bytes of 0x00
    if (forWitness && this.isCoinbase()) return Buffer.alloc(32, 0);
    return bcrypto.hash256(this.__toBuffer(undefined, undefined, forWitness));
  }
  getId() {
    // transaction hash's are displayed in reverse order
    return bufferutils_1.reverseBuffer(this.getHash(false)).toString('hex');
  }
  toBuffer(buffer, initialOffset) {
    return this.__toBuffer(buffer, initialOffset, true);
  }
  toHex() {
    return this.toBuffer(undefined, undefined).toString('hex');
  }
  setInputScript(index, scriptSig) {
    typeforce(types.tuple(types.Number, types.Buffer), arguments);
    this.ins[index].script = scriptSig;
  }
  setWitness(index, witness) {
    typeforce(types.tuple(types.Number, [types.Buffer]), arguments);
    this.ins[index].witness = witness;
  }
  __toBuffer(buffer, initialOffset, _ALLOW_WITNESS = false) {
    if (!buffer) buffer = Buffer.allocUnsafe(this.byteLength(_ALLOW_WITNESS));
    const bufferWriter = new bufferutils_1.BufferWriter(
      buffer,
      initialOffset || 0,
    );
    bufferWriter.writeInt32(this.version);
    if (this.version === 12) {
      bufferWriter.writeSlice(this.persentBlockHash)
    }
    const hasWitnesses = _ALLOW_WITNESS && this.hasWitnesses();
    if (hasWitnesses) {
      bufferWriter.writeUInt8(Transaction.ADVANCED_TRANSACTION_MARKER);
      bufferWriter.writeUInt8(Transaction.ADVANCED_TRANSACTION_FLAG);
    }
    bufferWriter.writeVarInt(this.ins.length);
    this.ins.forEach(txIn => {
      bufferWriter.writeSlice(txIn.hash);
      bufferWriter.writeUInt32(txIn.index);
      bufferWriter.writeVarSlice(txIn.script);
      bufferWriter.writeUInt32(txIn.sequence);
    });
    bufferWriter.writeVarInt(this.outs.length);
    this.outs.forEach(txOut => {
      if (isOutput(txOut)) {
        bufferWriter.writeUInt64(txOut.value);
      } else {
        bufferWriter.writeSlice(txOut.valueBuffer);
      }
      bufferWriter.writeVarSlice(txOut.script);
    });
    if (hasWitnesses) {
      this.ins.forEach(input => {
        bufferWriter.writeVector(input.witness);
      });
    }
    bufferWriter.writeUInt32(this.locktime);
    // avoid slicing unless necessary
    if (initialOffset !== undefined)
      return buffer.slice(initialOffset, bufferWriter.offset);
    return buffer;
  }
}
Transaction.DEFAULT_SEQUENCE = 0xffffffff;
Transaction.SIGHASH_ALL = 0x01;
Transaction.SIGHASH_NONE = 0x02;
Transaction.SIGHASH_SINGLE = 0x03;
Transaction.SIGHASH_ANYONECANPAY = 0x80;
Transaction.ADVANCED_TRANSACTION_MARKER = 0x00;
Transaction.ADVANCED_TRANSACTION_FLAG = 0x01;
exports.Transaction = Transaction;
