import { Network } from "./networks";
import Transaction from "./transaction";

export default class TransactionBuilder {
  constructor(network?: Network, maximumFeeRate?: number)

  public addInput(
    txhash: Buffer | string | Transaction,
    vout: number,
    sequence?: number,
    prevOutScript?: Buffer
  ): number

  public addOutput(scriptPubKey: Buffer | string, value: number): number

  build(): Transaction

  buildIncomplete(): Transaction

  public setLockTime(locktime: number): void

  public setVersion(version: number): void

  sign(
    vin: number,
    keyPair: ECPair,
    redeemScript?: Buffer,
    hashType?: number,
    witnessValue?: number,
    witnessScript?: Buffer
  ): void

  public static fromTransaction(
    transaction: Transaction,
    network?: Network
  ): TransactionBuilder
}
