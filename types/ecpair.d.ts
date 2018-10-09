import { Network } from "./network";

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

export interface ECPair {
  readonly compressed: boolean

  readonly privateKey: Buffer

  readonly publicKey: Buffer

  readonly network: Network

  sign(hash: Buffer): Buffer

  toWIF(): string

  verify(hash: Buffer, signature: Buffer): boolean
}
