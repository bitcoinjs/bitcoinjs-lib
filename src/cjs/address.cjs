'use strict';
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null)
      for (var k in mod)
        if (k !== 'default' && Object.prototype.hasOwnProperty.call(mod, k))
          __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
  };
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.fromBase58Check = fromBase58Check;
exports.fromBech32 = fromBech32;
exports.toBase58Check = toBase58Check;
exports.toBech32 = toBech32;
exports.fromOutputScript = fromOutputScript;
exports.toOutputScript = toOutputScript;
const networks = __importStar(require('./networks.cjs'));
const payments = __importStar(require('./payments/index.cjs'));
const bscript = __importStar(require('./script.cjs'));
const types_js_1 = require('./types.cjs');
const bech32_1 = require('bech32');
const bs58check_1 = __importDefault(require('bs58check'));
const tools = __importStar(require('uint8array-tools'));
const v = __importStar(require('valibot'));
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
  const payload = bs58check_1.default.decode(address);
  // TODO: 4.0.0, move to "toOutputScript"
  if (payload.length < 21) throw new TypeError(address + ' is too short');
  if (payload.length > 21) throw new TypeError(address + ' is too long');
  const version = tools.readUInt8(payload, 0);
  const hash = payload.slice(1);
  return { version, hash };
}
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
    data: Uint8Array.from(data),
  };
}
/**
 * Converts a hash to a Base58Check-encoded string.
 * @param hash - The hash to be encoded.
 * @param version - The version byte to be prepended to the encoded string.
 * @returns The Base58Check-encoded string.
 */
function toBase58Check(hash, version) {
  v.parse(v.tuple([types_js_1.Hash160bitSchema, types_js_1.UInt8Schema]), [
    hash,
    version,
  ]);
  const payload = new Uint8Array(21);
  tools.writeUInt8(payload, 0, version);
  payload.set(hash, 1);
  return bs58check_1.default.encode(payload);
}
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
