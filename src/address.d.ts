/// <reference types="node" />
/**
 * bitcoin address decode and encode tools, include base58、bech32 and output script
 *
 * networks support bitcoin、bitcoin testnet and bitcoin regtest
 *
 * addresses support P2PKH、P2SH、P2WPKH、P2WSH、P2TR and so on
 *
 * @packageDocumentation
 */
import { Network } from './networks';
/** base58check decode result */
export interface Base58CheckResult {
    /** address hash */
    hash: Buffer;
    /** address version: 0x00 for P2PKH, 0x05 for P2SH */
    version: number;
}
/** bech32 decode result */
export interface Bech32Result {
    /** address version: 0x00 for P2WPKH、P2WSH, 0x01 for P2TR*/
    version: number;
    /** address prefix: bc for P2WPKH、P2WSH、P2TR */
    prefix: string;
    /** address data：20 bytes for P2WPKH, 32 bytes for P2WSH、P2TR */
    data: Buffer;
}
/**
 * decode address with base58 specification,  return address version and address hash if valid
 */
export declare function fromBase58Check(address: string): Base58CheckResult;
/**
 * decode address with bech32 specification,  return address version、address prefix and address data if valid
 */
export declare function fromBech32(address: string): Bech32Result;
/**
 * encode address hash to base58 address with version
 */
export declare function toBase58Check(hash: Buffer, version: number): string;
/**
 * encode address hash to bech32 address with version and prefix
 */
export declare function toBech32(data: Buffer, version: number, prefix: string): string;
/**
 * decode address from output script with network, return address if matched
 */
export declare function fromOutputScript(output: Buffer, network?: Network): string;
/**
 * encodes address to output script with network, return output script if address matched
 */
export declare function toOutputScript(address: string, network?: Network): Buffer;
