/**
 * This file contains a plain javascript implementation of some basic schnorr
 * signing and verification methods.
 *
 * These methods are not intended for production use.
 *
 * Implementation mostly follows
 * https://github.com/bitcoin/bips/blob/master/bip-0340/reference.py
 *
 * This is a stop-gap measure until BitGoJS has full WebAssembly support and
 * can use tiny-secp256k1@2
 *
 * Functions and variable naming conventions are lifted from
 * https://github.com/bitcoinjs/tiny-secp256k1/blob/v1.1.6/js.js
 */
/// <reference types="node" />
export declare function isXOnlyPoint(x: Buffer): boolean;
export declare function verifySchnorr(hash: Buffer, q: Buffer, signature: Buffer): boolean;
export declare function signSchnorr(hash: Buffer, d: Buffer): Buffer;
export declare function signSchnorrWithEntropy(hash: Buffer, d: Buffer, auxRand: Buffer): Buffer;
