import { Payment, PaymentOpts } from './index'
import * as bscript from '../script'
import * as bcrypto from '../crypto'
import * as lazy from './lazy'
import { bitcoin as BITCOIN_NETWORK } from '../networks'
const typef = require('typeforce')
const OPS = require('bitcoin-ops')
const ecc = require('tiny-secp256k1')

const bs58check = require('bs58check')

// input: {signature} {pubkey}
// output: OP_DUP OP_HASH160 {hash160(pubkey)} OP_EQUALVERIFY OP_CHECKSIG
export function p2pkh (a: Payment, opts?: PaymentOpts): Payment {
  if (
    !a.address &&
    !a.hash &&
    !a.output &&
    !a.pubkey &&
    !a.input
  ) throw new TypeError('Not enough data')
  opts = Object.assign({ validate: true }, opts || {})

  typef({
    network: typef.maybe(typef.Object),
    address: typef.maybe(typef.String),
    hash: typef.maybe(typef.BufferN(20)),
    output: typef.maybe(typef.BufferN(25)),

    pubkey: typef.maybe(ecc.isPoint),
    signature: typef.maybe(bscript.isCanonicalScriptSignature),
    input: typef.maybe(typef.Buffer)
  }, a)

  const _address = lazy.value(function () {
    const payload = bs58check.decode(a.address)
    const version = payload.readUInt8(0)
    const hash = payload.slice(1)
    return { version, hash }
  })
  const _chunks = <()=>Array<Buffer | number>>lazy.value(function () { return bscript.decompile(<Buffer>a.input) })

  const network = a.network || BITCOIN_NETWORK
  const o: Payment = { network }

  lazy.prop(o, 'address', function () {
    if (!o.hash) return

    const payload = Buffer.allocUnsafe(21)
    payload.writeUInt8(network.pubKeyHash, 0)
    o.hash.copy(payload, 1)
    return bs58check.encode(payload)
  })
  lazy.prop(o, 'hash', function () {
    if (a.output) return a.output.slice(3, 23)
    if (a.address) return _address().hash
    if (a.pubkey || o.pubkey) return bcrypto.hash160(<Buffer>a.pubkey || <Buffer>o.pubkey)
  })
  lazy.prop(o, 'output', function () {
    if (!o.hash) return
    return bscript.compile([
      OPS.OP_DUP,
      OPS.OP_HASH160,
      o.hash,
      OPS.OP_EQUALVERIFY,
      OPS.OP_CHECKSIG
    ])
  })
  lazy.prop(o, 'pubkey', function () {
    if (!a.input) return
    return <Buffer>_chunks()[1]
  })
  lazy.prop(o, 'signature', function () {
    if (!a.input) return
    return <Buffer>_chunks()[0]
  })
  lazy.prop(o, 'input', function () {
    if (!a.pubkey) return
    if (!a.signature) return
    return bscript.compile([a.signature, a.pubkey])
  })
  lazy.prop(o, 'witness', function () {
    if (!o.input) return
    return []
  })

  // extended validation
  if (opts.validate) {
    let hash: Buffer = Buffer.from([])
    if (a.address) {
      if (_address().version !== network.pubKeyHash) throw new TypeError('Invalid version or Network mismatch')
      if (_address().hash.length !== 20) throw new TypeError('Invalid address')
      hash = _address().hash
    }

    if (a.hash) {
      if (hash.length > 0 && !hash.equals(a.hash)) throw new TypeError('Hash mismatch')
      else hash = a.hash
    }

    if (a.output) {
      if (
        a.output.length !== 25 ||
        a.output[0] !== OPS.OP_DUP ||
        a.output[1] !== OPS.OP_HASH160 ||
        a.output[2] !== 0x14 ||
        a.output[23] !== OPS.OP_EQUALVERIFY ||
        a.output[24] !== OPS.OP_CHECKSIG) throw new TypeError('Output is invalid')

      const hash2 = a.output.slice(3, 23)
      if (hash.length > 0 && !hash.equals(hash2)) throw new TypeError('Hash mismatch')
      else hash = hash2
    }

    if (a.pubkey) {
      const pkh = bcrypto.hash160(a.pubkey)
      if (hash.length > 0 && !hash.equals(pkh)) throw new TypeError('Hash mismatch')
      else hash = pkh
    }

    if (a.input) {
      const chunks = _chunks()
      if (chunks.length !== 2) throw new TypeError('Input is invalid')
      if (!bscript.isCanonicalScriptSignature(<Buffer>chunks[0])) throw new TypeError('Input has invalid signature')
      if (!ecc.isPoint(chunks[1])) throw new TypeError('Input has invalid pubkey')

      if (a.signature && !a.signature.equals(<Buffer>chunks[0])) throw new TypeError('Signature mismatch')
      if (a.pubkey && !a.pubkey.equals(<Buffer>chunks[1])) throw new TypeError('Pubkey mismatch')

      const pkh = bcrypto.hash160(<Buffer>chunks[1])
      if (hash.length > 0 && !hash.equals(pkh)) throw new TypeError('Hash mismatch')
    }
  }

  return Object.assign(o, a)
}
