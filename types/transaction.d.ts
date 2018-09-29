interface In {
  script: Buffer
  hash: Buffer
  index: number
  sequence: number
  witness: Buffer[]
}

interface Out {
  script: Buffer
  value: number
}

export default class Transaction {
  version: number
  locktime: number
  ins: In[]
  outs: Out[]
  constructor()

  addInput(
    hash: Buffer,
    index: number,
    sequence?: number,
    scriptSig?: Buffer
  ): number

  addOutput(scriptPubKey: Buffer | string, value: number): number

  byteLength(): number

  clone(): Transaction

  getHash(): Buffer

  getId(): string

  hasWitnesses(): boolean

  hashForSignature(
    inIndex: number,
    prevOutScript: Buffer,
    hashType: number
  ): Buffer

  hashForWitnessV0(
    inIndex: number,
    prevOutScript: Buffer,
    value: number,
    hashType: number
  ): Buffer

  isCoinbase(): boolean

  setInputScript(index: number, scriptSig: Buffer): void

  setWitness(index: number, witness: any, ...args: any[]): void

  toBuffer(buffer?: Buffer, initialOffset?: number): Buffer

  toHex(): string

  virtualSize(): number

  weight(): number

  static ADVANCED_TRANSACTION_FLAG: 0x01

  static ADVANCED_TRANSACTION_MARKER: 0x00

  static DEFAULT_SEQUENCE: 0xffffffff

  static SIGHASH_ALL: 0x01

  static SIGHASH_ANYONECANPAY: 0x80

  static SIGHASH_NONE: 0x02

  static SIGHASH_SINGLE: 0x03

  static fromBuffer(buffer: Buffer, __noStrict?: boolean): Transaction

  static fromHex(hex: string): Transaction

  static isCoinbaseHash(buffer: Buffer): boolean
}
