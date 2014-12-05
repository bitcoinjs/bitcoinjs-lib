var assert = require('assert')
var bigi = require('bigi')
var bitcoin = require('../../')
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
})
