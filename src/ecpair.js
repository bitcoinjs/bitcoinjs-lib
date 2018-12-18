const ecc = require('tiny-secp256k1')
const randomBytes = require('randombytes')
const typeforce = require('typeforce')
const types = require('./types')
const wif = require('wif')

const NETWORKS = require('./networks')
const isOptions = typeforce.maybe(typeforce.compile({
  compressed: types.maybe(types.Boolean),
  network: types.maybe(types.Network)
}))

class ECPair {
  constructor (d, Q, options) {
    options = options || {}

    this.compressed = options.compressed === undefined ? true : options.compressed
    this.network = options.network || NETWORKS.bitcoin

    this.__d = d || null
    this.__Q = null
    if (Q) this.__Q = ecc.pointCompress(Q, this.compressed)
  }

  get privateKey () {
    return this.__d
  }

  get publicKey () {
    if (!this.__Q) this.__Q = ecc.pointFromScalar(this.__d, this.compressed)
    return this.__Q
  }

  toWIF () {
    if (!this.__d) throw new Error('Missing private key')
    return wif.encode(this.network.wif, this.__d, this.compressed)
  }

  sign (hash) {
    if (!this.__d) throw new Error('Missing private key')
    return ecc.sign(hash, this.__d)
  }

  verify (hash, signature) {
    return ecc.verify(hash, this.publicKey, signature)
  }
}

function fromPrivateKey (buffer, options) {
  typeforce(types.Buffer256bit, buffer)
  if (!ecc.isPrivate(buffer)) throw new TypeError('Private key not in range [1, n)')
  typeforce(isOptions, options)

  return new ECPair(buffer, null, options)
}

function fromPublicKey (buffer, options) {
  typeforce(ecc.isPoint, buffer)
  typeforce(isOptions, options)
  return new ECPair(null, buffer, options)
}

function fromWIF (string, network) {
  const decoded = wif.decode(string)
  const version = decoded.version

  // list of networks?
  if (types.Array(network)) {
    network = network.filter(function (x) {
      return version === x.wif
    }).pop()

    if (!network) throw new Error('Unknown network version')

  // otherwise, assume a network object (or default to bitcoin)
  } else {
    network = network || NETWORKS.bitcoin

    if (version !== network.wif) throw new Error('Invalid network version')
  }

  return fromPrivateKey(decoded.privateKey, {
    compressed: decoded.compressed,
    network: network
  })
}

function makeRandom (options) {
  typeforce(isOptions, options)
  options = options || {}
  const rng = options.rng || randomBytes

  let d
  do {
    d = rng(32)
    typeforce(types.Buffer256bit, d)
  } while (!ecc.isPrivate(d))

  return fromPrivateKey(d, options)
}

module.exports = {
  makeRandom,
  fromPrivateKey,
  fromPublicKey,
  fromWIF
}
