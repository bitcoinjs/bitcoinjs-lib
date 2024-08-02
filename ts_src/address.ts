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
import * as networks from './networks';
import * as payments from './payments';
import * as bscript from './script';
import { typeforce, tuple, Hash160bit, UInt8 } from './types';
import { bech32, bech32m } from 'bech32';
import * as bs58check from 'bs58check';

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

const FUTURE_SEGWIT_MAX_SIZE: number = 40;
const FUTURE_SEGWIT_MIN_SIZE: number = 2;
const FUTURE_SEGWIT_MAX_VERSION: number = 16;
const FUTURE_SEGWIT_MIN_VERSION: number = 2;
const FUTURE_SEGWIT_VERSION_DIFF: number = 0x50;
const FUTURE_SEGWIT_VERSION_WARNING: string =
  'WARNING: Sending to a future segwit version address can lead to loss of funds. ' +
  'End users MUST be warned carefully in the GUI and asked if they wish to proceed ' +
  'with caution. Wallets should verify the segwit version from the output of fromBech32, ' +
  'then decide when it is safe to use which version of segwit.';

/**
 * Converts an output buffer to a future segwit address.
 * @param output - The output buffer.
 * @param network - The network object.
 * @returns The future segwit address.
 * @throws {TypeError} If the program length or version is invalid for segwit address.
 */
function _toFutureSegwitAddress(output: Buffer, network: Network): string {
  const data = output.slice(2);

  if (
    data.length < FUTURE_SEGWIT_MIN_SIZE ||
    data.length > FUTURE_SEGWIT_MAX_SIZE
  )
    throw new TypeError('Invalid program length for segwit address');

  const version = output[0] - FUTURE_SEGWIT_VERSION_DIFF;

  if (
    version < FUTURE_SEGWIT_MIN_VERSION ||
    version > FUTURE_SEGWIT_MAX_VERSION
  )
    throw new TypeError('Invalid version for segwit address');

  if (output[1] !== data.length)
    throw new TypeError('Invalid script for segwit address');

  console.warn(FUTURE_SEGWIT_VERSION_WARNING);

  return toBech32(data, version, network.bech32);
}

/**
 * Decodes a base58check encoded Bitcoin address and returns the version and hash.
 * 
 * @param address - The base58check encoded Bitcoin address to decode.
 * @returns An object containing the version and hash of the decoded address.
 * @throws {TypeError} If the address is too short or too long.
 */
export function fromBase58Check(address: string): Base58CheckResult {
  const payload = Buffer.from(bs58check.decode(address));

  // TODO: 4.0.0, move to "toOutputScript"
  if (payload.length < 21) throw new TypeError(address + ' is too short');
  if (payload.length > 21) throw new TypeError(address + ' is too long');

  const version = payload.readUInt8(0);
  const hash = payload.slice(1);

  return { version, hash };
}

/**
 * Converts a Bech32 or Bech32m encoded address to its corresponding data representation.
 * @param address - The Bech32 or Bech32m encoded address.
 * @returns An object containing the version, prefix, and data of the address.
 * @throws {TypeError} If the address uses the wrong encoding.
 */
export function fromBech32(address: string): Bech32Result {
  let result;
  let version;
  try {
    result = bech32.decode(address);
  } catch (e) {}

  if (result) {
    version = result.words[0];
    if (version !== 0) throw new TypeError(address + ' uses wrong encoding');
  } else {
    result = bech32m.decode(address);
    version = result.words[0];
    if (version === 0) throw new TypeError(address + ' uses wrong encoding');
  }

  const data = bech32.fromWords(result.words.slice(1));

  return {
    version,
    prefix: result.prefix,
    data: Buffer.from(data),
  };
}

/**
 * Converts a hash to a Base58Check-encoded string.
 * @param hash - The hash to be encoded.
 * @param version - The version byte to be prepended to the encoded string.
 * @returns The Base58Check-encoded string.
 */
export function toBase58Check(hash: Buffer, version: number): string {
  typeforce(tuple(Hash160bit, UInt8), arguments);

  const payload = Buffer.allocUnsafe(21);
  payload.writeUInt8(version, 0);
  hash.copy(payload, 1);

  return bs58check.encode(payload);
}

/**
 * Converts a buffer to a Bech32 or Bech32m encoded string.
 * @param data - The buffer to be encoded.
 * @param version - The version number to be used in the encoding.
 * @param prefix - The prefix string to be used in the encoding.
 * @returns The Bech32 or Bech32m encoded string.
 */
export function toBech32(
  data: Buffer,
  version: number,
  prefix: string,
): string {
  const words = bech32.toWords(data);
  words.unshift(version);

  return version === 0
    ? bech32.encode(prefix, words)
    : bech32m.encode(prefix, words);
}

/**
 * Converts an output script to a Bitcoin address.
 * @param output - The output script as a Buffer.
 * @param network - The Bitcoin network (optional).
 * @returns The Bitcoin address corresponding to the output script.
 * @throws If the output script has no matching address.
 */
export function fromOutputScript(output: Buffer, network?: Network): string {
  // TODO: Network
  network = network || networks.bitcoin;

  try {
    return payments.p2pkh({ output, network }).address as string;
  } catch (e) {}
  try {
    return payments.p2sh({ output, network }).address as string;
  } catch (e) {}
  try {
    return payments.p2wpkh({ output, network }).address as string;
  } catch (e) {}
  try {
    return payments.p2wsh({ output, network }).address as string;
  } catch (e) {}
  try {
    return payments.p2tr({ output, network }).address as string;
  } catch (e) {}
  try {
    return _toFutureSegwitAddress(output, network);
  } catch (e) {}

  throw new Error(bscript.toASM(output) + ' has no matching Address');
}

/**
 * Converts a Bitcoin address to its corresponding output script.
 * @param address - The Bitcoin address to convert.
 * @param network - The Bitcoin network to use. Defaults to the Bitcoin network.
 * @returns The corresponding output script as a Buffer.
 * @throws If the address has an invalid prefix or no matching script.
 */
export function toOutputScript(address: string, network?: Network): Buffer {
  network = network || networks.bitcoin;

  let decodeBase58: Base58CheckResult | undefined;
  let decodeBech32: Bech32Result | undefined;
  try {
    decodeBase58 = fromBase58Check(address);
  } catch (e) {}

  if (decodeBase58) {
    if (decodeBase58.version === network.pubKeyHash)
      return payments.p2pkh({ hash: decodeBase58.hash }).output as Buffer;
    if (decodeBase58.version === network.scriptHash)
      return payments.p2sh({ hash: decodeBase58.hash }).output as Buffer;
  } else {
    try {
      decodeBech32 = fromBech32(address);
    } catch (e) {}

    if (decodeBech32) {
      if (decodeBech32.prefix !== network.bech32)
        throw new Error(address + ' has an invalid prefix');
      if (decodeBech32.version === 0) {
        if (decodeBech32.data.length === 20)
          return payments.p2wpkh({ hash: decodeBech32.data }).output as Buffer;
        if (decodeBech32.data.length === 32)
          return payments.p2wsh({ hash: decodeBech32.data }).output as Buffer;
      } else if (decodeBech32.version === 1) {
        if (decodeBech32.data.length === 32)
          return payments.p2tr({ pubkey: decodeBech32.data }).output as Buffer;
      } else if (
        decodeBech32.version >= FUTURE_SEGWIT_MIN_VERSION &&
        decodeBech32.version <= FUTURE_SEGWIT_MAX_VERSION &&
        decodeBech32.data.length >= FUTURE_SEGWIT_MIN_SIZE &&
        decodeBech32.data.length <= FUTURE_SEGWIT_MAX_SIZE
      ) {
        console.warn(FUTURE_SEGWIT_VERSION_WARNING);

        return bscript.compile([
          decodeBech32.version + FUTURE_SEGWIT_VERSION_DIFF,
          decodeBech32.data,
        ]);
      }
    }
  }

  throw new Error(address + ' has no matching Script');
}
