import { BufferReader, BufferWriter, reverseBuffer } from './bufferutils';
import * as bcrypto from './crypto';
import * as networks from './networks';
import { Transaction } from './transaction';
import * as types from './types';

import * as eq from 'equihashjs-verify';

const fastMerkleRoot = require('merkle-lib/fastRoot');
const typeforce = require('typeforce');
const varuint = require('varuint-bitcoin');

const errorMerkleNoTxes = new TypeError(
  'Cannot compute merkle root for zero transactions',
);
const errorWitnessNotSegwit = new TypeError(
  'Cannot compute witness commit for non-segwit block',
);

export class Block {
  static fromBuffer(buffer: Buffer): Block {
    if (buffer.length < 140) throw new Error('Buffer too small (< 140 bytes)');

    const bufferReader = new BufferReader(buffer);

    const block = new Block();
    block.version = bufferReader.readInt32();
    block.prevHash = bufferReader.readSlice(32);
    block.merkleRoot = bufferReader.readSlice(32);
    block.height = bufferReader.readUInt32();
    block.reserved = bufferReader.readSlice(28);
    block.timestamp = bufferReader.readUInt32();
    block.bits = bufferReader.readUInt32();
    block.nonce = bufferReader.readSlice(32);
    block.solutionLength = bufferReader.readVarInt();
    block.solution = bufferReader.readSlice(block.solutionLength);

    if (buffer.length === bufferReader.offset) return block;

    const readTransaction = (): any => {
      const tx = Transaction.fromBuffer(
        bufferReader.buffer.slice(bufferReader.offset),
        true,
      );
      bufferReader.offset += tx.byteLength();
      return tx;
    };

    const nTransactions = bufferReader.readVarInt();
    block.transactions = [];

    for (let i = 0; i < nTransactions; ++i) {
      const tx = readTransaction();
      block.transactions.push(tx);
    }

    const witnessCommit = block.getWitnessCommit();
    // This Block contains a witness commit
    if (witnessCommit) block.witnessCommit = witnessCommit;

    return block;
  }

  static fromHex(hex: string): Block {
    return Block.fromBuffer(Buffer.from(hex, 'hex'));
  }

  static calculateTarget(bits: number): Buffer {
    const exponent = ((bits & 0xff000000) >> 24) - 3;
    const mantissa = bits & 0x007fffff;
    const target = Buffer.alloc(32, 0);
    target.writeUIntBE(mantissa, 29 - exponent, 3);
    return target;
  }

  static calculateMerkleRoot(
    transactions: Transaction[],
    forWitness?: boolean,
  ): Buffer {
    typeforce([{ getHash: types.Function }], transactions);
    if (transactions.length === 0) throw errorMerkleNoTxes;
    if (forWitness && !txesHaveWitnessCommit(transactions))
      throw errorWitnessNotSegwit;

    const hashes = transactions.map(transaction =>
      transaction.getHash(forWitness!),
    );

    const rootHash = fastMerkleRoot(hashes, bcrypto.hash256);

    return forWitness
      ? bcrypto.hash256(
          Buffer.concat([rootHash, transactions[0].ins[0].witness[0]]),
        )
      : rootHash;
  }

  version: number = 1;
  prevHash?: Buffer = undefined;
  merkleRoot?: Buffer = undefined;
  height: number = 0;
  reserved?: Buffer = undefined;
  timestamp: number = 0;
  witnessCommit?: Buffer = undefined;
  bits: number = 0;
  nonce?: Buffer = undefined;
  solutionLength = 0;
  solution?: Buffer = undefined;
  transactions?: Transaction[] = undefined;

  getWitnessCommit(): Buffer | null {
    if (!txesHaveWitnessCommit(this.transactions!)) return null;

    // The merkle root for the witness data is in an OP_RETURN output.
    // There is no rule for the index of the output, so use filter to find it.
    // The root is prepended with 0xaa21a9ed so check for 0x6a24aa21a9ed
    // If multiple commits are found, the output with highest index is assumed.
    const witnessCommits = this.transactions![0].outs.filter(out =>
      out.script.slice(0, 6).equals(Buffer.from('6a24aa21a9ed', 'hex')),
    ).map(out => out.script.slice(6, 38));
    if (witnessCommits.length === 0) return null;
    // Use the commit with the highest output (should only be one though)
    const result = witnessCommits[witnessCommits.length - 1];

    if (!(result instanceof Buffer && result.length === 32)) return null;
    return result;
  }

  hasWitnessCommit(): boolean {
    if (
      this.witnessCommit instanceof Buffer &&
      this.witnessCommit.length === 32
    )
      return true;
    if (this.getWitnessCommit() !== null) return true;
    return false;
  }

  hasWitness(): boolean {
    return anyTxHasWitness(this.transactions!);
  }

  weight(): number {
    const base = this.byteLength(false, false);
    const total = this.byteLength(false, true);
    return base * 3 + total;
  }

  byteLength(
    headersOnly?: boolean,
    allowWitness: boolean = true,
    useLegacyFormat: boolean = false,
  ): number {
    // Solution can have different size, for regtest/testnet is arround 140-170, for mainnet 1400-1500
    let headerSize: number;

    if (useLegacyFormat) {
      headerSize = 80;
    } else {
      headerSize =
        140 +
        varuint.encodingLength(this.solutionLength) +
        this.solution!.length;
    }

    if (headersOnly || !this.transactions) return headerSize;

    return (
      headerSize +
      varuint.encodingLength(this.transactions.length) +
      this.transactions.reduce((a, x) => a + x.byteLength(allowWitness), 0)
    );
  }

  getHash(network: networks.Network = networks.bitcoingold): Buffer {
    const useLegacyFormat = this.height < network.forkHeight!;
    console.warn({ useLegacyFormat });
    return bcrypto.hash256(this.toBuffer(true, useLegacyFormat));
  }

  getId(network: networks.Network = networks.bitcoingold): string {
    return reverseBuffer(this.getHash(network)).toString('hex');
  }

  getUTCDate(): Date {
    const date = new Date(0); // epoch
    date.setUTCSeconds(this.timestamp);

    return date;
  }

  // TODO: buffer, offset compatibility
  toBuffer(headersOnly?: boolean, useLegacyFormat: boolean = false): Buffer {
    const buffer: Buffer = Buffer.allocUnsafe(
      this.byteLength(headersOnly, undefined, useLegacyFormat),
    );

    const bufferWriter = new BufferWriter(buffer);

    bufferWriter.writeInt32(this.version);
    bufferWriter.writeSlice(this.prevHash!);
    bufferWriter.writeSlice(this.merkleRoot!);
    if (useLegacyFormat) {
      bufferWriter.writeUInt32(this.timestamp);
      bufferWriter.writeUInt32(this.bits);
      bufferWriter.writeSlice(this.nonce!.slice(0, 4));
    } else {
      bufferWriter.writeInt32(this.height);
      bufferWriter.writeSlice(this.reserved!);
      bufferWriter.writeUInt32(this.timestamp);
      bufferWriter.writeUInt32(this.bits);
      bufferWriter.writeSlice(this.nonce!);
      bufferWriter.writeVarInt(this.solutionLength);
      bufferWriter.writeSlice(this.solution!);
    }

    if (headersOnly || !this.transactions) return buffer;

    varuint.encode(this.transactions.length, buffer, bufferWriter.offset);
    bufferWriter.offset += varuint.encode.bytes;

    this.transactions.forEach(tx => {
      const txSize = tx.byteLength(); // TODO: extract from toBuffer?
      tx.toBuffer(buffer, bufferWriter.offset);
      bufferWriter.offset += txSize;
    });

    return buffer;
  }

  toHex(headersOnly?: boolean, useLegacyFormat: boolean = false): string {
    return this.toBuffer(headersOnly, useLegacyFormat).toString('hex');
  }

  checkTxRoots(): boolean {
    // If the Block has segwit transactions but no witness commit,
    // there's no way it can be valid, so fail the check.
    const hasWitnessCommit = this.hasWitnessCommit();
    if (!hasWitnessCommit && this.hasWitness()) return false;
    return (
      this.__checkMerkleRoot() &&
      (hasWitnessCommit ? this.__checkWitnessCommit() : true)
    );
  }

  checkProofOfWork(
    validateSolution: boolean,
    network: networks.Network,
  ): boolean {
    const hash: Buffer = reverseBuffer(this.getHash());
    const target = Block.calculateTarget(this.bits);
    const validTarget = hash.compare(target) <= 0;

    if (
      this.height < network.forkHeight! ||
      !validateSolution ||
      !validTarget
    ) {
      console.log(
        '### checkProofOfWork prefork or not required to validate solutions',
        { height: this.height, validateSolution, validTarget },
      );
      return validTarget;
    }

    let equihashNetwork: eq.Network;
    if (
      network.equihashForkHeight &&
      this.height < network.equihashForkHeight
    ) {
      equihashNetwork = network.equihashLegacy!;
    } else {
      equihashNetwork = network.equihash || eq.networks.bitcoingold;
    }

    const equihash = new eq.Equihash(equihashNetwork);
    const header = this.toHex(true);
    return equihash.verify(Buffer.from(header, 'hex'), this.solution!);
  }

  private __checkMerkleRoot(): boolean {
    if (!this.transactions) throw errorMerkleNoTxes;

    const actualMerkleRoot = Block.calculateMerkleRoot(this.transactions);
    return this.merkleRoot!.compare(actualMerkleRoot) === 0;
  }

  private __checkWitnessCommit(): boolean {
    if (!this.transactions) throw errorMerkleNoTxes;
    if (!this.hasWitnessCommit()) throw errorWitnessNotSegwit;

    const actualWitnessCommit = Block.calculateMerkleRoot(
      this.transactions,
      true,
    );
    return this.witnessCommit!.compare(actualWitnessCommit) === 0;
  }
}

function txesHaveWitnessCommit(transactions: Transaction[]): boolean {
  return (
    transactions instanceof Array &&
    transactions[0] &&
    transactions[0].ins &&
    transactions[0].ins instanceof Array &&
    transactions[0].ins[0] &&
    transactions[0].ins[0].witness &&
    transactions[0].ins[0].witness instanceof Array &&
    transactions[0].ins[0].witness.length > 0
  );
}

function anyTxHasWitness(transactions: Transaction[]): boolean {
  return (
    transactions instanceof Array &&
    transactions.some(
      tx =>
        typeof tx === 'object' &&
        tx.ins instanceof Array &&
        tx.ins.some(
          input =>
            typeof input === 'object' &&
            input.witness instanceof Array &&
            input.witness.length > 0,
        ),
    )
  );
}

export type BlockGold = Block;
