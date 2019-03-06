const Buffer = require('safe-buffer').Buffer
const bech32 = require('bech32')
const bs58check = require('bs58check')
const bscript = require('./script')
const networks = require('./networks')
const typeforce = require('typeforce')
const types = require('./types')
const payments = require('./payments')

function fromBase58Check (address, network) {
  const payload = bs58check.decode(address)
  network = network || networks.bitcoin

  // TODO: 4.0.0, move to "toOutputScript"
  if (payload.length < network.bytes) throw new TypeError(address + ' is too short')
  if (payload.length > network.bytes) throw new TypeError(address + ' is too long')

  // const version = payload.readUInt8(0)
  // const hash = payload.slice(1)
  let version
  const hash = payload.slice(network.versionBytes)
  if (network.versionBytes === 1) {
    version = payload.readUInt8(0)
  } else if (network.versionBytes === 2) {
    version = payload.readUInt16BE(0)
  }
  if (network.versionBase === 16) {
    version = version.toString(16)
  }

  return { version: version, hash: hash }
}

function fromBech32 (address) {
  const result = bech32.decode(address)
  const data = bech32.fromWords(result.words.slice(1))

  return {
    version: result.words[0],
    prefix: result.prefix,
    data: Buffer.from(data)
  }
}

function toBase58Check (hash, version, network) {
  typeforce(types.tuple(types.Hash160bit, types.UInt8), [hash, network.bytes])
  typeforce(types.anyOf(types.UInt8, typeforce.HexN(2), typeforce.HexN(4)), version)
  network = network || networks.bitcoin

  if (types.UInt8(version)) {
    version = ('0' + version.toString(16)).slice(-2)
  }

  const payload = Buffer.allocUnsafe(network.bytes)
  const versionBuf = Buffer.from(version, 'hex')
  const bufLength = versionBuf.length

  versionBuf.copy(payload, 0)
  hash.copy(payload, bufLength)

  return bs58check.encode(payload)
}

function toBech32 (data, version, prefix) {
  const words = bech32.toWords(data)
  words.unshift(version)

  return bech32.encode(prefix, words)
}

function fromOutputScript (output, network) {
  network = network || networks.bitcoin

  try { return payments.p2pkh({ output, network }).address } catch (e) {}
  try { return payments.p2sh({ output, network }).address } catch (e) {}
  try { return payments.p2wpkh({ output, network }).address } catch (e) {}
  try { return payments.p2wsh({ output, network }).address } catch (e) {}

  throw new Error(bscript.toASM(output) + ' has no matching Address')
}

function toOutputScript (address, network) {
  network = network || networks.bitcoin

  let decode
  try {
    decode = fromBase58Check(address, network)
  } catch (e) {}

  if (decode) {
    if (decode.version === network.pubKeyHash) return payments.p2pkh({ hash: decode.hash }).output
    if (decode.version === network.scriptHash) return payments.p2sh({ hash: decode.hash, network: network }).output
    if (network.versionBase === 16) {
      if (decode.version === network.scriptHash.toString(16)) return payments.p2sh({ hash: decode.hash, network: network }).output
    }
  } else {
    try {
      decode = fromBech32(address)
    } catch (e) {}

    if (decode) {
      if (decode.prefix !== network.bech32) throw new Error(address + ' has an invalid prefix')
      if (decode.version === 0) {
        if (decode.data.length === 20) return payments.p2wpkh({ hash: decode.data }).output
        if (decode.data.length === 32) return payments.p2wsh({ hash: decode.data }).output
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
