const Buffer = require('safe-buffer').Buffer
const { bech32, bech32m } = require('bech32')
const bs58check = require('bs58check')
const bscript = require('./script')
const networks = require('./networks')
const typeforce = require('typeforce')
const types = require('./types')
const payments = require('./payments')

const FUTURE_SEGWIT_MAX_SIZE = 40
const FUTURE_SEGWIT_MIN_SIZE = 2
const FUTURE_SEGWIT_MAX_VERSION = 16
const FUTURE_SEGWIT_MIN_VERSION = 1
const FUTURE_SEGWIT_VERSION_DIFF = 0x50
function _toFutureSegwitAddress (output, network) {
  const data = output.slice(2)
  if (
    data.length < FUTURE_SEGWIT_MIN_SIZE ||
    data.length > FUTURE_SEGWIT_MAX_SIZE
  ) { throw new TypeError('Invalid program length for segwit address') }
  const version = output[0] - FUTURE_SEGWIT_VERSION_DIFF
  if (
    version < FUTURE_SEGWIT_MIN_VERSION ||
    version > FUTURE_SEGWIT_MAX_VERSION
  ) { throw new TypeError('Invalid version for segwit address') }
  if (output[1] !== data.length) { throw new TypeError('Invalid script for segwit address') }
  return toBech32(data, version, network.bech32)
}

function fromBase58Check (address) {
  const payload = bs58check.decode(address)

  // TODO: 4.0.0, move to "toOutputScript"
  if (payload.length < 21) throw new TypeError(address + ' is too short')
  if (payload.length > 21) throw new TypeError(address + ' is too long')

  const version = payload.readUInt8(0)
  const hash = payload.slice(1)

  return { version: version, hash: hash }
}

function fromBech32 (address) {
  let result
  let version
  try {
    result = bech32.decode(address)
  } catch (e) {}
  if (result) {
    version = result.words[0]
    if (version !== 0) throw new TypeError(address + ' uses wrong encoding')
  } else {
    result = bech32m.decode(address)
    version = result.words[0]
    if (version === 0) throw new TypeError(address + ' uses wrong encoding')
  }
  const data = bech32.fromWords(result.words.slice(1))

  return {
    version,
    prefix: result.prefix,
    data: Buffer.from(data)
  }
}

function toBase58Check (hash, version) {
  typeforce(types.tuple(types.Hash160bit, types.UInt8), arguments)

  const payload = Buffer.allocUnsafe(21)
  payload.writeUInt8(version, 0)
  hash.copy(payload, 1)

  return bs58check.encode(payload)
}

function toBech32 (data, version, prefix) {
  const words = bech32.toWords(data)
  words.unshift(version)

  return version === 0
    ? bech32.encode(prefix, words)
    : bech32m.encode(prefix, words)
}

function fromOutputScript (output, network) {
  network = network || networks.bitcoin

  try { return payments.p2pkh({ output, network }).address } catch (e) {}
  try { return payments.p2sh({ output, network }).address } catch (e) {}
  try { return payments.p2wpkh({ output, network }).address } catch (e) {}
  try { return payments.p2wsh({ output, network }).address } catch (e) {}
  try { return _toFutureSegwitAddress(output, network) } catch (e) {}

  throw new Error(bscript.toASM(output) + ' has no matching Address')
}

function toOutputScript (address, network) {
  network = network || networks.bitcoin

  let decode
  try {
    decode = fromBase58Check(address)
  } catch (e) {}

  if (decode) {
    if (decode.version === network.pubKeyHash) return payments.p2pkh({ hash: decode.hash }).output
    if (decode.version === network.scriptHash) return payments.p2sh({ hash: decode.hash }).output
  } else {
    try {
      decode = fromBech32(address)
    } catch (e) {}

    if (decode) {
      if (decode.prefix !== network.bech32) throw new Error(address + ' has an invalid prefix')
      if (decode.version === 0) {
        if (decode.data.length === 20) return payments.p2wpkh({ hash: decode.data }).output
        if (decode.data.length === 32) return payments.p2wsh({ hash: decode.data }).output
      } else if (
        decode.version >= FUTURE_SEGWIT_MIN_VERSION &&
        decode.version <= FUTURE_SEGWIT_MAX_VERSION &&
        decode.data.length >= FUTURE_SEGWIT_MIN_SIZE &&
        decode.data.length <= FUTURE_SEGWIT_MAX_SIZE
      ) {
        return bscript.compile([
          decode.version + FUTURE_SEGWIT_VERSION_DIFF,
          decode.data
        ])
      }
    }
  }

  throw new Error(address + ' has no matching Script')
}

module.exports = {
  fromBase58Check: fromBase58Check,
  fromBech32: fromBech32,
  fromOutputScript: fromOutputScript,
  toBase58Check: toBase58Check,
  toBech32: toBech32,
  toOutputScript: toOutputScript
}
