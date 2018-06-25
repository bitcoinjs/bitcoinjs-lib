/* global describe, it */

const assert = require('assert')
const bigi = require('bigi')
const bitcoin = require('../../')
const bip32 = require('bip32')
const crypto = require('crypto')
const tinysecp = require('tiny-secp256k1')

const ecurve = require('ecurve')
const secp256k1 = ecurve.getCurveByName('secp256k1')

describe('bitcoinjs-lib (crypto)', function () {
  it('can recover a private key from duplicate R values', function () {
    this.timeout(30000)

    // https://blockchain.info/tx/f4c16475f2a6e9c602e4a287f9db3040e319eb9ece74761a4b84bc820fbeef50
    const tx = bitcoin.Transaction.fromHex('01000000020b668015b32a6178d8524cfef6dc6fc0a4751915c2e9b2ed2d2eab02424341c8000000006a47304402205e00298dc5265b7a914974c9d0298aa0e69a0ca932cb52a360436d6a622e5cd7022024bf5f506968f5f23f1835574d5afe0e9021b4a5b65cf9742332d5e4acb68f41012103fd089f73735129f3d798a657aaaa4aa62a00fa15c76b61fc7f1b27ed1d0f35b8ffffffffa95fa69f11dc1cbb77ef64f25a95d4b12ebda57d19d843333819d95c9172ff89000000006b48304502205e00298dc5265b7a914974c9d0298aa0e69a0ca932cb52a360436d6a622e5cd7022100832176b59e8f50c56631acbc824bcba936c9476c559c42a4468be98975d07562012103fd089f73735129f3d798a657aaaa4aa62a00fa15c76b61fc7f1b27ed1d0f35b8ffffffff02b000eb04000000001976a91472956eed9a8ecb19ae7e3ebd7b06cae4668696a788ac303db000000000001976a9146c0bd55dd2592287cd9992ce3ba3fc1208fb76da88ac00000000')

    tx.ins.forEach(function (input, vin) {
      const script = input.script
      const scriptChunks = bitcoin.script.decompile(script)

      assert(bitcoin.script.pubKeyHash.input.check(scriptChunks), 'Expected pubKeyHash script')
      const prevOutScript = bitcoin.address.toOutputScript('1ArJ9vRaQcoQ29mTWZH768AmRwzb6Zif1z')
      const scriptSignature = bitcoin.script.signature.decode(scriptChunks[0])
      const publicKey = bitcoin.ECPair.fromPublicKey(scriptChunks[1])

      const m = tx.hashForSignature(vin, prevOutScript, scriptSignature.hashType)
      assert(publicKey.verify(m, scriptSignature.signature), 'Invalid m')

      // store the required information
      input.signature = scriptSignature.signature
      input.z = bigi.fromBuffer(m)
    })

    // finally, run the tasks, then on to the math
    const n = secp256k1.n

    for (var i = 0; i < tx.ins.length; ++i) {
      for (var j = i + 1; j < tx.ins.length; ++j) {
        const inputA = tx.ins[i]
        const inputB = tx.ins[j]

        // enforce matching r values
        const r = inputA.signature.slice(0, 32)
        const rB = inputB.signature.slice(0, 32)
        assert.strictEqual(r.toString('hex'), rB.toString('hex'))

        const rInv = bigi.fromBuffer(r).modInverse(n)

        const s1 = bigi.fromBuffer(inputA.signature.slice(32, 64))
        const s2 = bigi.fromBuffer(inputB.signature.slice(32, 64))
        const z1 = inputA.z
        const z2 = inputB.z

        const zz = z1.subtract(z2).mod(n)
        const ss = s1.subtract(s2).mod(n)

        // k = (z1 - z2) / (s1 - s2)
        // d1 = (s1 * k - z1) / r
        // d2 = (s2 * k - z2) / r
        const k = zz.multiply(ss.modInverse(n)).mod(n)
        const d1 = ((s1.multiply(k).mod(n)).subtract(z1).mod(n)).multiply(rInv).mod(n)
        const d2 = ((s2.multiply(k).mod(n)).subtract(z2).mod(n)).multiply(rInv).mod(n)

        // enforce matching private keys
        assert.strictEqual(d1.toString(), d2.toString())
      }
    }
  })

  it('can recover a BIP32 parent private key from the parent public key, and a derived, non-hardened child private key', function () {
    function recoverParent (master, child) {
      assert(master.isNeutered(), 'You already have the parent private key')
      assert(!child.isNeutered(), 'Missing child private key')

      const serQP = master.publicKey
      const d1 = child.privateKey
      const data = Buffer.alloc(37)
      serQP.copy(data, 0)

      // search index space until we find it
      let d2
      for (var i = 0; i < 0x80000000; ++i) {
        data.writeUInt32BE(i, 33)

        // calculate I
        const I = crypto.createHmac('sha512', master.chainCode).update(data).digest()
        const IL = I.slice(0, 32)

        // See bip32.js:273 to understand
        d2 = tinysecp.privateSub(d1, IL)

        const Qp = bip32.fromPrivateKey(d2, Buffer.alloc(32, 0)).publicKey
        if (Qp.equals(serQP)) break
      }

      const node = bip32.fromPrivateKey(d2, master.chainCode, master.network)
      node.depth = master.depth
      node.index = master.index
      node.masterFingerprint = master.masterFingerprint
      return node
    }

    const seed = crypto.randomBytes(32)
    const master = bip32.fromSeed(seed)
    const child = master.derive(6) // m/6

    // now for the recovery
    const neuteredMaster = master.neutered()
    const recovered = recoverParent(neuteredMaster, child)
    assert.strictEqual(recovered.toBase58(), master.toBase58())
  })
})
