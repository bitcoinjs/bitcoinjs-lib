/** 
 * These types were originally written by 
 * Mohamed Hegazy https://github.com/mhegazy,
 * Daniel https://github.com/dlebrecht, 
 * Ron Buckton https://github.com/rbuckton, 
 * Satana Charuwichitratana https://github.com/micksatana, 
 * Youssef GHOUBACH https://github.com/youssefgh, 
 * Kento https://github.com/kento1218.
 */

import Transaction from './transaction'

declare class Block {
  constructor()

  byteLength(headersOnly?: boolean): number

  checkMerkleRoot(): boolean

  checkProofOfWork(): boolean

  getHash(): Buffer

  getId(): string

  getUTCDate(): Date

  toBuffer(headersOnly?: boolean): Buffer

  toHex(headersOnly?: boolean): string

  static calculateMerkleRoot(
    transactions: Transaction[] | Array<{ getHash(): Buffer }>
  ): Buffer

  static calculateTarget(bits: number): Buffer

  static fromBuffer(buffer: Buffer): Block

  static fromHex(hex: string): Block
}

export default Block
