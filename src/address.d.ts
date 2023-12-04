/// <reference types="node" />
import { Network } from './networks';
export interface Base58CheckResult {
    hash: Buffer;
    version: number;
}
export interface Bech32Result {
    version: number;
    prefix: string;
    data: Buffer;
}
export declare function fromBase58Check(address: string): Base58CheckResult;
export declare function fromBech32(address: string): Bech32Result;
export declare function toBase58Check(hash: Buffer, version: number): string;
export declare function toBech32(data: Buffer, version: number, prefix: string): string;
export declare function fromOutputScript(output: Buffer, network?: Network): string;
/**
 * This uses the logic from Bitcoin Core to decide what is the dust threshold for a given script.
 *
 * Ref: https://github.com/bitcoin/bitcoin/blob/160d23677ad799cf9b493eaa923b2ac080c3fb8e/src/policy/policy.cpp#L26-L63
 *
 * @param {Buffer} script - This is the script to evaluate a dust limit for.
 * @param {number} [satPerVb=1] - This is to account for different MIN_RELAY_TX_FEE amounts. Bitcoin Core does not calculate
 *                                dust based on the mempool ejection cutoff, but always by the MIN_RELAY_TX_FEE.
 *                                This argument should be passed in as satoshi per vByte. Not satoshi per kvByte like Core.
 */
export declare function dustAmountFromOutputScript(script: Buffer, satPerVb?: number): number;
export declare function toOutputScript(address: string, network?: Network): Buffer;
