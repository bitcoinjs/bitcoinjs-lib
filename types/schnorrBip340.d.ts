/**
 * This file contains a plain javascript implementation of some basic schnorr
 * signing and verification methods as defined in bip-0340:
 * https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki
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
/**
 * @param x - Buffer
 * @return {Boolean} - true iff x is a valid 32-byte x-only public key buffer
 */
export declare function isXOnlyPoint(x: Buffer): boolean;
/**
 * @param hash - message hash
 * @param q - public key buffer (x-only format, 32 byte)
 * @param signature - schnorr signature (64 bytes)
 * @throws {TypeError} - if any of the arguments is invalid
 * @return {Boolean} - true iff the signature is valid
 */
export declare function verifySchnorr(hash: Buffer, q: Buffer, signature: Buffer): boolean;
/**
 * Create signature with extraData
 *
 * Quote BIP0340:
 * ```
 * The auxiliary random data should be set to fresh randomness generated at
 * signing time, resulting in what is called a synthetic nonce.
 * Using 32 bytes of randomness is optimal.
 * ...
 * Note that while this means the resulting nonce is not deterministic,
 * the randomness is only supplemental to security.
 * ```
 *
 * @param hash - the message hash
 * @param d - the private key buffer
 * @param extraData - aka auxiliary random data
 * @return {Buffer} - signature
 */
export declare function signSchnorr(hash: Buffer, d: Buffer, extraData: Buffer): Buffer;
/**
 * Create signature without external randomness.
 * This slightly reduces security.
 * Use only if no external randomness is available.
 * Quote from BIP0340:
 *
 * ```
 * Using any non-repeating value increases protection against fault injection
 * attacks. Using unpredictable randomness additionally increases protection
 * against other side-channel attacks, and is recommended whenever available.
 * Note that while this means the resulting nonce is not deterministic,
 * the randomness is only supplemental to security.
 * ```
 *
 * @param hash - the message hash
 * @param d - the private key buffer
 * @return {Buffer} - signature
 */
export declare function signSchnorrWithoutExtraData(hash: Buffer, d: Buffer): Buffer;
