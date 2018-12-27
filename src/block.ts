const Buffer = require('safe-buffer').Buffer
const bcrypto = require('./crypto')
const fastMerkleRoot = require('merkle-lib/fastRoot')
const typeforce = require('typeforce')
const types = require('./types')
const varuint = require('varuint-bitcoin')

const errorMerkleNoTxes = new TypeError('Cannot compute merkle root for zero transactions')
const errorWitnessNotSegwit = new TypeError('Cannot compute witness commit for non-segwit block')
const errorBufferTooSmall = new Error('Buffer too small (< 80 bytes)')

function txesHaveWitness (transactions: Array<any>): boolean {
  return transactions !== undefined &&
    transactions instanceof Array &&
    transactions[0] &&
    transactions[0].ins &&
    transactions[0].ins instanceof Array &&
    transactions[0].ins[0] &&
    transactions[0].ins[0].witness &&
    transactions[0].ins[0].witness instanceof Array &&
    transactions[0].ins[0].witness.length > 0
}

const Transaction = require('./transaction')

export class Block {
  version: number
  prevHash: Buffer
  merkleRoot: Buffer
  timestamp: number
  witnessCommit: Buffer
  bits: number
  nonce: number
  transactions: Array<any>

  constructor () {
    this.version = 1
    this.timestamp = 0
    this.bits = 0
    this.nonce = 0
  }

  static fromBuffer (buffer: Buffer): Block {
    if (buffer.length < 80) throw errorBufferTooSmall

    let offset: number = 0
    const readSlice = (n: number): Buffer => {
      offset += n
      return buffer.slice(offset - n, offset)
    }

    const readUInt32 = (): number => {
      const i = buffer.readUInt32LE(offset)
      offset += 4
      return i
    }

    const readInt32 = (): number => {
      const i = buffer.readInt32LE(offset)
      offset += 4
      return i
    }

    const block = new Block()
    block.version = readInt32()
    block.prevHash = readSlice(32)
    block.merkleRoot = readSlice(32)
    block.timestamp = readUInt32()
    block.bits = readUInt32()
    block.nonce = readUInt32()

    if (buffer.length === 80) return block

    const readVarInt = (): number => {
      const vi = varuint.decode(buffer, offset)
      offset += varuint.decode.bytes
      return vi
    }

    const readTransaction = (): any => {
      const tx = Transaction.fromBuffer(buffer.slice(offset), true)
      offset += tx.byteLength()
      return tx
    }

    const nTransactions = readVarInt()
    block.transactions = []

    for (var i = 0; i < nTransactions; ++i) {
      const tx = readTransaction()
      block.transactions.push(tx)
    }

    // This Block contains a witness commit
    if (block.hasWitnessCommit()) {
      // The merkle root for the witness data is in an OP_RETURN output.
      // There is no rule for the index of the output, so use filter to find it.
      // The root is prepended with 0xaa21a9ed so check for 0x6a24aa21a9ed
      // If multiple commits are found, the output with highest index is assumed.
      let witnessCommits = block.transactions[0].outs
        .filter(out => out.script.slice(0, 6).equals(Buffer.from('6a24aa21a9ed', 'hex')))
        .map(out => out.script.slice(6, 38))

      // Use the commit with the highest output (should only be one though)
      block.witnessCommit = witnessCommits[witnessCommits.length - 1]
    }

    return block
  }

  static fromHex (hex: string): Block {
    return Block.fromBuffer(Buffer.from(hex, 'hex'))
  }

  static calculateTarget (bits: number): Buffer {
    const exponent = ((bits & 0xff000000) >> 24) - 3
    const mantissa = bits & 0x007fffff
    const target = Buffer.alloc(32, 0)
    target.writeUIntBE(mantissa, 29 - exponent, 3)
    return target
  }

  static calculateMerkleRoot (transactions: Array<any>, forWitness: boolean | void): Buffer {
    typeforce([{ getHash: types.Function }], transactions)
    if (transactions.length === 0) throw errorMerkleNoTxes
    if (forWitness && !txesHaveWitness(transactions)) throw errorWitnessNotSegwit

    const hashes = transactions.map(transaction => transaction.getHash(forWitness))

    const rootHash = fastMerkleRoot(hashes, bcrypto.hash256)

    return forWitness
      ? bcrypto.hash256(Buffer.concat([rootHash, transactions[0].ins[0].witness[0]]))
      : rootHash
  }

  hasWitnessCommit (): boolean {
    return txesHaveWitness(this.transactions)
  }

  byteLength (headersOnly: boolean): number {
    if (headersOnly || !this.transactions) return 80

    return 80 + varuint.encodingLength(this.transactions.length) +
      this.transactions.reduce((a, x) => a + x.byteLength(), 0)
  }

  getHash (): Buffer {
    return bcrypto.hash256(this.toBuffer(true))
  }

  getId (): string {
    return Buffer.from(this.getHash().reverse()).toString('hex')
  }

  getUTCDate (): Date {
    const date = new Date(0) // epoch
    date.setUTCSeconds(this.timestamp)

    return date
  }

  // TODO: buffer, offset compatibility
  toBuffer (headersOnly: boolean): Buffer {
    const buffer: Buffer = Buffer.allocUnsafe(this.byteLength(headersOnly))

    let offset: number = 0
    const writeSlice = (slice: Buffer): void => {
      slice.copy(buffer, offset)
      offset += slice.length
    }

    const writeInt32 = (i: number): void => {
      buffer.writeInt32LE(i, offset)
      offset += 4
    }
    const writeUInt32 = (i: number): void => {
      buffer.writeUInt32LE(i, offset)
      offset += 4
    }

    writeInt32(this.version)
    writeSlice(this.prevHash)
    writeSlice(this.merkleRoot)
    writeUInt32(this.timestamp)
    writeUInt32(this.bits)
    writeUInt32(this.nonce)

    if (headersOnly || !this.transactions) return buffer

    varuint.encode(this.transactions.length, buffer, offset)
    offset += varuint.encode.bytes

    this.transactions.forEach(tx => {
      const txSize = tx.byteLength() // TODO: extract from toBuffer?
      tx.toBuffer(buffer, offset)
      offset += txSize
    })

    return buffer
  }

  toHex (headersOnly: boolean): string {
    return this.toBuffer(headersOnly).toString('hex')
  }

  checkMerkleRoot (): boolean {
    if (!this.transactions) throw errorMerkleNoTxes

    const actualMerkleRoot = Block.calculateMerkleRoot(this.transactions)
    return this.merkleRoot.compare(actualMerkleRoot) === 0
  }

  checkWitnessCommit (): boolean {
    if (!this.transactions) throw errorMerkleNoTxes
    if (!this.hasWitnessCommit()) throw errorWitnessNotSegwit

    const actualWitnessCommit = Block.calculateMerkleRoot(this.transactions, true)
    return this.witnessCommit.compare(actualWitnessCommit) === 0
  }

  checkProofOfWork (): boolean {
    const hash: Buffer = Buffer.from(this.getHash().reverse())
    const target = Block.calculateTarget(this.bits)

    return hash.compare(target) <= 0
  }
}
