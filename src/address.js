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
 * decode address with base58 specification,  return address version and address hash if valid
 * @case
 * ```ts
 * // You can test it here and find more case in test/address.spec.ts
 * const result = address.fromBase58Check('1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH')
 * console.log(JSON.stringify(result))
 * // => {"version":0,"hash":{"type":"Buffer","data":[117,30,118,232,25,145,150,212,84,148,28,69,209,179,163,35,241,67,59,214]}}
 * ```
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
 * decode address with bech32 specification,  return address version、address prefix and address data if valid
 * @example
 * ```ts
 * // valid case
 * fromBech32('BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4')
 * // => {version: 0, prefix: 'bc', data: <Buffer 75 1e 76 e8 19 91 96 d4 54 94 1c 45 d1 b3 a3 23 f1 43 3b d6>}
 *
 * // invalid case
 * fromBase58Check('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5')
 * // => Invalid checksum
 *
 * // invalid case
 * fromBase58Check('tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sL5k7')
 * // => Mixed-case string
 *
 * // invalid case
 * fromBase58Check('tb1pw508d6qejxtdg4y5r3zarquvzkan')
 * // => Excess padding
 *
 * // invalid case
 * fromBase58Check('bc1zw508d6qejxtdg4y5r3zarvaryvq37eag7')
 * // => Excess padding
 *
 * // invalid case
 * fromBase58Check('bc1zw508d6qejxtdg4y5r3zarvaryvq37eag7')
 * // => Non-zero padding
 *
 * // invalid case
 * fromBase58Check('tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3pjxtptv')
 * // => uses wrong encoding
 *
 * // invalid case
 * fromBase58Check('bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqh2y7hd')
 * // => uses wrong encoding
 * ```
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
 * encode address hash to base58 address with version
 *
 * @example
 * ```ts
 * // valid case
 * toBase58Check('751e76e8199196d454941c45d1b3a323f1433bd6', 0)
 * // => 1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH
 * ```
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
 * encode address hash to bech32 address with version and prefix
 *
 * @example
 * ```ts
 * // valid case
 * toBech32('000000c4a5cad46221b2a187905e5266362b99d5e91c6ce24d165dab93e86433', 0, 'tb)
 * // => tb1qqqqqp399et2xygdj5xreqhjjvcmzhxw4aywxecjdzew6hylgvsesrxh6hy
 * ```
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
 * decode address from output script with network, return address if matched
 * @example
 * ```ts
 * // valid case
 * fromOutputScript('OP_DUP OP_HASH160 751e76e8199196d454941c45d1b3a323f1433bd6 OP_EQUALVERIFY OP_CHECKSIG', 'bicoin)
 * // => 1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH
 *
 * // invalid case
 * fromOutputScript('031f1e68f82112b373f0fe980b3a89d212d2b5c01fb51eb25acb8b4c4b4299ce95 OP_CHECKSIG', undefined)
 * // => has no matching Address
 *
 * // invalid case
 * fromOutputScript('OP_TRUE 032487c2a32f7c8d57d2a93906a6457afd00697925b0e6e145d89af6d3bca33016 02308673d16987eaa010e540901cc6fe3695e758c19f46ce604e174dac315e685a OP_2 OP_CHECKMULTISIG', undefined)
 * // => has no matching Address
 *
 * // invalid case
 * fromOutputScript('OP_RETURN 06deadbeef03f895a2ad89fb6d696497af486cb7c644a27aa568c7a18dd06113401115185474', undefined)
 * // => has no matching Address
 *
 * // invalid case
 * fromOutputScript('OP_0 75', undefined)
 * // => has no matching Address
 *
 * // invalid case
 * fromOutputScript('OP_0 751e76e8199196d454941c45d1b3a323f1433bd6751e76e8199196d454941c45d1b3a323f1433bd675', undefined)
 * // => has no matching Address
 *
 * // invalid case
 * fromOutputScript('OP_1 75', undefined)
 * // => has no matching Address
 *
 * // invalid case
 * fromOutputScript('OP_1 751e76e8199196d454941c45d1b3a323f1433bd6751e76e8199196d454941c45d1b3a323f1433bd675', undefined)
 * // => has no matching Address
 *
 * // invalid case
 * fromOutputScript('OP_1 fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f', undefined)
 * // => has no matching Address
 *
 * ```
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
 * encodes address to output script with network, return output script if address matched
 * @example
 * ```ts
 * // valid case
 * toOutputScript('1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH', 'bicoin)
 * // => OP_DUP OP_HASH160 751e76e8199196d454941c45d1b3a323f1433bd6 OP_EQUALVERIFY OP_CHECKSIG
 *
 * // invalid case
 * toOutputScript('24kPZCmVgzfkpGdXExy56234MRHrsqQxNWE', undefined)
 * // => has no matching Script
 *
 * // invalid case
 * toOutputScript('BC1SW50QGDZ25J', { "bech32": "foo" })
 * // => has an invalid prefix
 *
 * // invalid case
 * toOutputScript('bc1rw5uspcuh', undefined)
 * // => has no matching Script
 * ```
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
