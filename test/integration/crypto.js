/* global describe, it */

var assert = require('assert')
var async = require('async')
var bigi = require('bigi')
var bitcoin = require('../../')
var blockchain = require('./_blockchain')
var crypto = require('crypto')

var ecurve = require('ecurve')
var secp256k1 = ecurve.getCurveByName('secp256k1')

describe('bitcoinjs-lib (crypto)', function () {
  it('can generate a single-key stealth address', function () {
    var G = secp256k1.G
    var n = secp256k1.n

    function stealthSend (Q) {
      var noncePair = bitcoin.ECPair.makeRandom()
      var e = noncePair.d
      var eQ = Q.multiply(e) // shared secret
      var c = bigi.fromBuffer(bitcoin.crypto.sha256(eQ.getEncoded()))
      var cG = G.multiply(c)
      var Qprime = Q.add(cG)

      return {
        shared: new bitcoin.ECPair(null, Qprime),
        nonce: new bitcoin.ECPair(null, noncePair.Q)
      }
    }

    function stealthReceive (d, P) {
      var dP = P.multiply(d) // shared secret
      var c = bigi.fromBuffer(bitcoin.crypto.sha256(dP.getEncoded()))
      var derived = new bitcoin.ECPair(d.add(c).mod(n))

      return derived
    }

    // receiver private key
    var receiver = bitcoin.ECPair.fromWIF('5KYZdUEo39z3FPrtuX2QbbwGnNP5zTd7yyr2SC1j299sBCnWjss')

    var stealthS = stealthSend(receiver.Q) // public, done by sender
    // ... sender now reveals nonce to receiver

    var stealthR = stealthReceive(receiver.d, stealthS.nonce.Q) // private, done by receiver

    // and check that we derived both sides correctly
    assert.equal(stealthS.shared.getAddress(), stealthR.getAddress())
  })

  // TODO
  it.skip('can generate a dual-key stealth address', function () {})

  it("can recover a parent private key from the parent's public key and a derived non-hardened child private key", function () {
    function recoverParent (master, child) {
      assert(!master.keyPair.d, 'You already have the parent private key')
      assert(child.keyPair.d, 'Missing child private key')

      var curve = secp256k1
      var QP = master.keyPair.Q
      var serQP = master.keyPair.getPublicKeyBuffer()

      var d1 = child.keyPair.d
      var d2
      var data = new Buffer(37)
      serQP.copy(data, 0)

      // search index space until we find it
      for (var i = 0; i < bitcoin.HDNode.HIGHEST_BIT; ++i) {
        data.writeUInt32BE(i, 33)

        // calculate I
        var I = crypto.createHmac('sha512', master.chainCode).update(data).digest()
        var IL = I.slice(0, 32)
        var pIL = bigi.fromBuffer(IL)

        // See hdnode.js:273 to understand
        d2 = d1.subtract(pIL).mod(curve.n)

        var Qp = new bitcoin.ECPair(d2).Q
        if (Qp.equals(QP)) break
      }

      var node = new bitcoin.HDNode(new bitcoin.ECPair(d2), master.chainCode, master.network)
      node.depth = master.depth
      node.index = master.index
      node.masterFingerprint = master.masterFingerprint
      return node
    }

    var seed = crypto.randomBytes(32)
    var master = bitcoin.HDNode.fromSeedBuffer(seed)
    var child = master.derive(6) // m/6

    // now for the recovery
    var neuteredMaster = master.neutered()
    var recovered = recoverParent(neuteredMaster, child)
    assert.strictEqual(recovered.toBase58(), master.toBase58())
  })

  it('can recover a private key from duplicate R values', function (done) {
    this.timeout(10000)

    var inputs = [
      {
        txId: 'f4c16475f2a6e9c602e4a287f9db3040e319eb9ece74761a4b84bc820fbeef50',
        vout: 0
      },
      {
        txId: 'f4c16475f2a6e9c602e4a287f9db3040e319eb9ece74761a4b84bc820fbeef50',
        vout: 1
      }
    ]

    var txIds = inputs.map(function (x) { return x.txId })

    // first retrieve the relevant transactions
    blockchain.m.transactions.get(txIds, function (err, results) {
      assert.ifError(err)

      var transactions = {}
      results.forEach(function (tx) {
        transactions[tx.txId] = bitcoin.Transaction.fromHex(tx.txHex)
      })

      var tasks = []

      // now we need to collect/transform a bit of data from the selected inputs
      inputs.forEach(function (input) {
        var transaction = transactions[input.txId]
        var script = transaction.ins[input.vout].script
        var scriptChunks = bitcoin.script.decompile(script)

        assert(bitcoin.script.isPubKeyHashInput(scriptChunks), 'Expected pubKeyHash script')

        var prevOutTxId = [].reverse.call(new Buffer(transaction.ins[input.vout].hash)).toString('hex')
        var prevVout = transaction.ins[input.vout].index

        tasks.push(function (callback) {
          blockchain.m.transactions.get(prevOutTxId, function (err, result) {
            if (err) return callback(err)

            var prevOut = bitcoin.Transaction.fromHex(result.txHex)
            var prevOutScript = prevOut.outs[prevVout].script

            var scriptSignature = bitcoin.ECSignature.parseScriptSignature(scriptChunks[0])
            var publicKey = bitcoin.ECPair.fromPublicKeyBuffer(scriptChunks[1])

            var m = transaction.hashForSignature(input.vout, prevOutScript, scriptSignature.hashType)
            assert(publicKey.verify(m, scriptSignature.signature), 'Invalid m')

            // store the required information
            input.signature = scriptSignature.signature
            input.z = bigi.fromBuffer(m)

            return callback()
          })
        })
      })

      // finally, run the tasks, then on to the math
      async.parallel(tasks, function (err) {
        if (err) throw err

        var n = secp256k1.n

        for (var i = 0; i < inputs.length; ++i) {
          for (var j = i + 1; j < inputs.length; ++j) {
            var inputA = inputs[i]
            var inputB = inputs[j]

            // enforce matching r values
            assert.strictEqual(inputA.signature.r.toString(), inputB.signature.r.toString())
            var r = inputA.signature.r
            var rInv = r.modInverse(n)

            var s1 = inputA.signature.s
            var s2 = inputB.signature.s
            var z1 = inputA.z
            var z2 = inputB.z

            var zz = z1.subtract(z2).mod(n)
            var ss = s1.subtract(s2).mod(n)

            // k = (z1 - z2) / (s1 - s2)
            // d1 = (s1 * k - z1) / r
            // d2 = (s2 * k - z2) / r
            var k = zz.multiply(ss.modInverse(n)).mod(n)
            var d1 = ((s1.multiply(k).mod(n)).subtract(z1).mod(n)).multiply(rInv).mod(n)
            var d2 = ((s2.multiply(k).mod(n)).subtract(z2).mod(n)).multiply(rInv).mod(n)

            // enforce matching private keys
            assert.strictEqual(d1.toString(), d2.toString())
          }
        }

        done()
      })
    })
  })
})
