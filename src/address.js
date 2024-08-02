'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.toOutputScript =
  exports.fromOutputScript =
  exports.toBech32 =
  exports.toBase58Check =
  exports.fromBech32 =
  exports.fromBase58Check =
    void 0;
const networks = require('./networks');
const payments = require('./payments');
const bscript = require('./script');
const types_1 = require('./types');
const bech32_1 = require('bech32');
const bs58check = require('bs58check');
const FUTURE_SEGWIT_MAX_SIZE = 40;
const FUTURE_SEGWIT_MIN_SIZE = 2;
const FUTURE_SEGWIT_MAX_VERSION = 16;
const FUTURE_SEGWIT_MIN_VERSION = 2;
const FUTURE_SEGWIT_VERSION_DIFF = 0x50;
const FUTURE_SEGWIT_VERSION_WARNING =
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
function _toFutureSegwitAddress(output, network) {
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
function fromBase58Check(address) {
  const payload = Buffer.from(bs58check.decode(address));
  // TODO: 4.0.0, move to "toOutputScript"
  if (payload.length < 21) throw new TypeError(address + ' is too short');
  if (payload.length > 21) throw new TypeError(address + ' is too long');
  const version = payload.readUInt8(0);
  const hash = payload.slice(1);
  return { version, hash };
}
exports.fromBase58Check = fromBase58Check;
/**
 * Converts a Bech32 or Bech32m encoded address to its corresponding data representation.
 * @param address - The Bech32 or Bech32m encoded address.
 * @returns An object containing the version, prefix, and data of the address.
 * @throws {TypeError} If the address uses the wrong encoding.
 */
function fromBech32(address) {
  let result;
  let version;
  try {
    result = bech32_1.bech32.decode(address);
  } catch (e) {}
  if (result) {
    version = result.words[0];
    if (version !== 0) throw new TypeError(address + ' uses wrong encoding');
  } else {
    result = bech32_1.bech32m.decode(address);
    version = result.words[0];
    if (version === 0) throw new TypeError(address + ' uses wrong encoding');
  }
  const data = bech32_1.bech32.fromWords(result.words.slice(1));
  return {
    version,
    prefix: result.prefix,
    data: Buffer.from(data),
  };
}
exports.fromBech32 = fromBech32;
/**
 * Converts a hash to a Base58Check-encoded string.
 * @param hash - The hash to be encoded.
 * @param version - The version byte to be prepended to the encoded string.
 * @returns The Base58Check-encoded string.
 */
function toBase58Check(hash, version) {
  (0, types_1.typeforce)(
    (0, types_1.tuple)(types_1.Hash160bit, types_1.UInt8),
    arguments,
  );
  const payload = Buffer.allocUnsafe(21);
  payload.writeUInt8(version, 0);
  hash.copy(payload, 1);
  return bs58check.encode(payload);
}
exports.toBase58Check = toBase58Check;
/**
 * Converts a buffer to a Bech32 or Bech32m encoded string.
 * @param data - The buffer to be encoded.
 * @param version - The version number to be used in the encoding.
 * @param prefix - The prefix string to be used in the encoding.
 * @returns The Bech32 or Bech32m encoded string.
 */
function toBech32(data, version, prefix) {
  const words = bech32_1.bech32.toWords(data);
  words.unshift(version);
  return version === 0
    ? bech32_1.bech32.encode(prefix, words)
    : bech32_1.bech32m.encode(prefix, words);
}
exports.toBech32 = toBech32;
/**
 * Converts an output script to a Bitcoin address.
 * @param output - The output script as a Buffer.
 * @param network - The Bitcoin network (optional).
 * @returns The Bitcoin address corresponding to the output script.
 * @throws If the output script has no matching address.
 */
function fromOutputScript(output, network) {
  // TODO: Network
  network = network || networks.bitcoin;
  try {
    return payments.p2pkh({ output, network }).address;
  } catch (e) {}
  try {
    return payments.p2sh({ output, network }).address;
  } catch (e) {}
  try {
    return payments.p2wpkh({ output, network }).address;
  } catch (e) {}
  try {
    return payments.p2wsh({ output, network }).address;
  } catch (e) {}
  try {
    return payments.p2tr({ output, network }).address;
  } catch (e) {}
  try {
    return _toFutureSegwitAddress(output, network);
  } catch (e) {}
  throw new Error(bscript.toASM(output) + ' has no matching Address');
}
exports.fromOutputScript = fromOutputScript;
/**
 * Converts a Bitcoin address to its corresponding output script.
 * @param address - The Bitcoin address to convert.
 * @param network - The Bitcoin network to use. Defaults to the Bitcoin network.
 * @returns The corresponding output script as a Buffer.
 * @throws If the address has an invalid prefix or no matching script.
 */
function toOutputScript(address, network) {
  network = network || networks.bitcoin;
  let decodeBase58;
  let decodeBech32;
  try {
    decodeBase58 = fromBase58Check(address);
  } catch (e) {}
  if (decodeBase58) {
    if (decodeBase58.version === network.pubKeyHash)
      return payments.p2pkh({ hash: decodeBase58.hash }).output;
    if (decodeBase58.version === network.scriptHash)
      return payments.p2sh({ hash: decodeBase58.hash }).output;
  } else {
    try {
      decodeBech32 = fromBech32(address);
    } catch (e) {}
    if (decodeBech32) {
      if (decodeBech32.prefix !== network.bech32)
        throw new Error(address + ' has an invalid prefix');
      if (decodeBech32.version === 0) {
        if (decodeBech32.data.length === 20)
          return payments.p2wpkh({ hash: decodeBech32.data }).output;
        if (decodeBech32.data.length === 32)
          return payments.p2wsh({ hash: decodeBech32.data }).output;
      } else if (decodeBech32.version === 1) {
        if (decodeBech32.data.length === 32)
          return payments.p2tr({ pubkey: decodeBech32.data }).output;
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
exports.toOutputScript = toOutputScript;
