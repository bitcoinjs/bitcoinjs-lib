var assert = require('assert')
var async = require('async')
var bigi = require('bigi')
var bitcoin = require('../../')
var blockchain = new (require('cb-helloblock'))('bitcoin')
var crypto = require('crypto')

describe('bitcoinjs-lib (crypto)', function() {
  it('can generate a single-key stealth address', function() {
    var receiver = bitcoin.ECKey.fromWIF('5KYZdUEo39z3FPrtuX2QbbwGnNP5zTd7yyr2SC1j299sBCnWjss')

    // XXX: ephemeral, must be random (and secret to sender) to preserve privacy
    var sender = bitcoin.ECKey.fromWIF('Kxr9tQED9H44gCmp6HAdmemAzU3n84H3dGkuWTKvE23JgHMW8gct')

    var G = bitcoin.ECKey.curve.G
    var d = receiver.d // secret (receiver only)
    var Q = receiver.pub.Q // shared

    var e = sender.d // secret (sender only)
    var P = sender.pub.Q // shared

    // derived shared secret
    var eQ = Q.multiply(e) // sender
    var dP = P.multiply(d) // receiver
    assert.deepEqual(eQ.getEncoded(), dP.getEncoded())

    var c = bigi.fromBuffer(bitcoin.crypto.sha256(eQ.getEncoded()))
    var cG = G.multiply(c)

    // derived public key
    var QprimeS = Q.add(cG)
    var QprimeR = G.multiply(d.add(c))
    assert.deepEqual(QprimeR.getEncoded(), QprimeS.getEncoded())

    // derived shared-secret address
    var address = new bitcoin.ECPubKey(QprimeS).getAddress().toString()

    assert.equal(address, '1EwCNJNZM5q58YPPTnjR1H5BvYRNeyZi47')
  })

  // TODO
  it.skip('can generate a dual-key stealth address', function() {})

  it('can recover a parent private key from the parent\'s public key and a derived non-hardened child private key', function() {
    function recoverParent(master, child) {
      assert(!master.privKey, 'You already have the parent private key')
      assert(child.privKey, 'Missing child private key')

      var curve = bitcoin.ECKey.curve
      var QP = master.pubKey.toBuffer()
      var QP64 = QP.toString('base64')
      var d1 = child.privKey.d
      var d2
      var indexBuffer = new Buffer(4)

      // search index space until we find it
      for (var i = 0; i < bitcoin.HDNode.HIGHEST_BIT; ++i) {
        indexBuffer.writeUInt32BE(i, 0)

        // calculate I
        var data = Buffer.concat([QP, indexBuffer])
        var I = crypto.createHmac('sha512', master.chainCode).update(data).digest()
        var IL = I.slice(0, 32)
        var pIL = bigi.fromBuffer(IL)

        // See hdnode.js:273 to understand
        d2 = d1.subtract(pIL).mod(curve.n)

        var Qp = new bitcoin.ECKey(d2, true).pub.toBuffer()
        if (Qp.toString('base64') === QP64) break
      }

      var node = new bitcoin.HDNode(d2, master.chainCode, master.network)
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
    assert.equal(recovered.toBase58(), master.toBase58())
  })

  it('can recover a private key from duplicate R values', function() {
    var inputs = [
      {
        txId: "f4c16475f2a6e9c602e4a287f9db3040e319eb9ece74761a4b84bc820fbeef50",
        vout: 0
      },
      {
        txId: "f4c16475f2a6e9c602e4a287f9db3040e319eb9ece74761a4b84bc820fbeef50",
        vout: 1
      }
    ]

    var txIds = inputs.map(function(x) { return x.txId })

    // first retrieve the relevant transactions
    blockchain.transactions.get(txIds, function(err, results) {
      assert.ifError(err)

      var transactions = {}
      results.forEach(function(tx) {
        transactions[tx.txId] = bitcoin.Transaction.fromHex(tx.txHex)
      })

      var tasks = []

      // now we need to collect/transform a bit of data from the selected inputs
      inputs.forEach(function(input) {
        var transaction = transactions[input.txId]
        var script = transaction.ins[input.vout].script
        assert(bitcoin.scripts.isPubKeyHashInput(script), 'Expected pubKeyHash script')

        var prevOutTxId = bitcoin.bufferutils.reverse(transaction.ins[input.vout].hash).toString('hex')
        var prevVout = transaction.ins[input.vout].index

        tasks.push(function(callback) {
          blockchain.transactions.get(prevOutTxId, function(err, result) {
            if (err) return callback(err)

            var prevOut = bitcoin.Transaction.fromHex(result.txHex)
            var prevOutScript = prevOut.outs[prevVout].script

            var scriptSignature = bitcoin.ECSignature.parseScriptSignature(script.chunks[0])
            var publicKey = bitcoin.ECPubKey.fromBuffer(script.chunks[1])

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
      async.parallel(tasks, function(err) {
        if (err) throw err
        var n = bitcoin.ECKey.curve.n

        for (var i = 0; i < inputs.length; ++i) {
          for (var j = i + 1; j < inputs.length; ++j) {
            var inputA = inputs[i]
            var inputB = inputs[j]

            // enforce matching r values
            assert.equal(inputA.signature.r.toString(), inputB.signature.r.toString())
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
            var d1 = (( s1.multiply(k).mod(n) ).subtract(z1).mod(n) ).multiply(rInv).mod(n)
            var d2 = (( s2.multiply(k).mod(n) ).subtract(z2).mod(n) ).multiply(rInv).mod(n)

            // enforce matching private keys
            assert.equal(d1.toString(), d2.toString())
          }
        }
      })
    })
  })
})
