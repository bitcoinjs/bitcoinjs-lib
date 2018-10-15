/** 
 * These types were originally written by 
 * Mohamed Hegazy https://github.com/mhegazy,
 * Daniel https://github.com/dlebrecht, 
 * Ron Buckton https://github.com/rbuckton, 
 * Satana Charuwichitratana https://github.com/micksatana, 
 * Youssef GHOUBACH https://github.com/youssefgh, 
 * Kento https://github.com/kento1218.
 */

import { Network } from "./networks";

export namespace ECPair {

  function fromPrivateKey(
    buffer: Buffer,
    options?: { compressed?: boolean; network?: Network }
  ): ECPair

  function fromPublicKey(
    buffer: Buffer,
    options?: { compressed?: boolean; network?: Network }
  ): ECPair

  function fromWIF(string: string, network?: Network): ECPair

  function makeRandom(options?: {
    compressed?: boolean
    network?: Network
    rng?: Rng
  }): ECPair
}

export type Rng = (size: number) => Buffer

export interface ECPair {
  readonly compressed: boolean

  readonly privateKey: Buffer

  readonly publicKey: Buffer

  readonly network: Network

  sign(hash: Buffer): Buffer

  toWIF(): string

  verify(hash: Buffer, signature: Buffer): boolean
}
