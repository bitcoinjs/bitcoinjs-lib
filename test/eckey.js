var assert = require('assert')

var crypto = require('..').crypto
var ECKey = require('../src/eckey.js').ECKey
var ECPubKey = require('../src/eckey.js').ECPubKey

describe('ECKey', function() {
  describe('constructor', function() {
    it('parses hex', function() {
      var priv = '18e14a7b6a307f426a94f8114701e7c8e774e7f9a47e2c2035db29a206321725'
      var pub = '0450863ad64a87ae8a2fe83c1af1a8403cb53f53e486d8511dad8a04887e5b235' +
        '22cd470243453a299fa9e77237716103abc11a1df38855ed6f2ee187e9c582ba6'
      var key = ECKey.fromHex(priv, false)

      assert.equal(key.pub.toHex(), pub)
      assert.equal(key.pub.compressed, false)
    })

    it('parses WIF', function() {
      var priv = '5HwoXVkHoRM8sL2KmNRS217n1g8mPPBomrY7yehCuXC1115WWsh'
      var pub = '044f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0' +
        'f0b704075871aa385b6b1b8ead809ca67454d9683fcf2ba03456d6fe2c4abe2b07f0fbdbb2f1c1'
      var addr = '1MsHWS1BnwMc3tLE8G35UXsS58fKipzB7a'
      var key = ECKey.fromWIF(priv)

      assert.equal(key.pub.compressed, false)
      assert.equal(key.pub.toHex(), pub)
      assert.equal(key.pub.getAddress().toString(), addr)
    })

    it('parses compressed WIF', function() {
      var priv = 'KwntMbt59tTsj8xqpqYqRRWufyjGunvhSyeMo3NTYpFYzZbXJ5Hp'
      var pub = '034f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa'
      var addr = '1Q1pE5vPGEEMqRcVRMbtBK842Y6Pzo6nK9'
      var key = ECKey.fromWIF(priv)

      assert.equal(key.pub.compressed, true)
      assert.equal(key.pub.toHex(), pub)
      assert.equal(key.pub.getAddress().toString(), addr)
    })

    it('alternative constructor syntax', function() {
      var priv = 'ca48ec9783cf3ad0dfeff1fc254395a2e403cbbc666477b61b45e31d3b8ab458'
      var pub = '044b12d9d7c77db68388b6ff7c89046174c871546436806bcd80d07c28ea81199' +
        '283fbec990dad6fb98f93f712d50cb874dd717de6a184158d63886dda3090f566'
      var key = ECKey.fromHex(priv, false)

      assert.equal(key.pub.toHex(), pub)
      assert.equal(key.pub.compressed, false)
      assert.equal(key.toHex(), priv)
    })
  })

  describe('toAddress', function() {
    var privkeys = [
      'ca48ec9783cf3ad0dfeff1fc254395a2e403cbbc666477b61b45e31d3b8ab458',
      '1111111111111111111111111111111111111111111111111111111111111111',
      '18e14a7b6a307f426a94f8114701e7c8e774e7f9a47e2c2035db29a206321725'
    ]

    // compressed pubkeys
    var cpubkeys = [
      '024b12d9d7c77db68388b6ff7c89046174c871546436806bcd80d07c28ea811992',
      '034f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa',
      '0250863ad64a87ae8a2fe83c1af1a8403cb53f53e486d8511dad8a04887e5b2352'
    ]

    var pubkeys = cpubkeys.map(function(x) {
      var pk = ECPubKey.fromHex(x)
      pk.compressed = false
      return pk.toHex()
    })

    it('bitcoin', function() {
      var addresses = [
        '19SgmoUj4xowEjwtXvNAtYTAgbvR9iBCui',
        '1MsHWS1BnwMc3tLE8G35UXsS58fKipzB7a',
        '16UwLL9Risc3QfPqBUvKofHmBQ7wMtjvM'
      ]
      var compressedAddresses = [
        '1AA4sjKW2aUmbtN3MtegdvhYtDBbDEke1q',
        '1Q1pE5vPGEEMqRcVRMbtBK842Y6Pzo6nK9',
        '1PMycacnJaSqwwJqjawXBErnLsZ7RkXUAs',
      ]

      for (var i = 0; i < addresses.length; ++i) {
        var pub = ECPubKey.fromHex(pubkeys[i])
        var cpub = ECPubKey.fromHex(cpubkeys[i])
        cpub.compressed = true

        var addr = addresses[i]
        var caddr = compressedAddresses[i]

        assert.equal(pub.getAddress().toString(), addr)
        assert.equal(cpub.getAddress().toString(), caddr)
      }
    })

    it('testnet', function() {
      var addresses = [
        '19SgmoUj4xowEjwtXvNAtYTAgbvR9iBCui',
        '1MsHWS1BnwMc3tLE8G35UXsS58fKipzB7a',
        '16UwLL9Risc3QfPqBUvKofHmBQ7wMtjvM'
      ]
      var compressedAddresses = [
        '1AA4sjKW2aUmbtN3MtegdvhYtDBbDEke1q',
        '1Q1pE5vPGEEMqRcVRMbtBK842Y6Pzo6nK9',
        '1PMycacnJaSqwwJqjawXBErnLsZ7RkXUAs',
      ]

      for (var i = 0; i < addresses.length; ++i) {
        var pub = ECPubKey.fromHex(pubkeys[i])
        var cpub = ECPubKey.fromHex(cpubkeys[i])
        cpub.compressed = true

        var addr = addresses[i]
        var caddr = compressedAddresses[i]

        assert.equal(pub.getAddress().toString(), addr)
        assert.equal(cpub.getAddress().toString(), caddr)
      }
    })
  })

  describe('signing', function() {
    var hpriv = 'ca48ec9783cf3ad0dfeff1fc254395a2e403cbbc666477b61b45e31d3b8ab458'
    var hcpub = '024b12d9d7c77db68388b6ff7c89046174c871546436806bcd80d07c28ea811992'
    var hash = crypto.sha256('Vires in numeris')

    it('should verify against the private key', function() {
      var priv = ECKey.fromHex(hpriv)
      var signature = priv.sign(hash)

      assert(priv.pub.verify(hash, signature))
    })

    it('should verify against the public key', function() {
      var priv = ECKey.fromHex(hpriv)
      var pub = ECPubKey.fromHex(hcpub, true)
      var signature = priv.sign(hash)

      assert(pub.verify(hash, signature))
    })

    it('should not verify against the wrong private key', function() {
      var priv1 = ECKey.fromHex(hpriv)
      var priv2 = ECKey.fromHex('1111111111111111111111111111111111111111111111111111111111111111')

      var signature = priv1.sign(hash)

      assert(!priv2.pub.verify(hash, signature))
    })
  })

  describe('output of ECPubKey', function() {
    var hcpub = '024b12d9d7c77db68388b6ff7c89046174c871546436806bcd80d07c28ea811992'
    var hpub = '044b12d9d7c77db68388b6ff7c89046174c871546436806bcd80d07c28ea81199283fbec990dad6fb98f93f712d50cb874dd717de6a184158d63886dda3090f566'

    it('using toHex should support compression', function() {
      var pub = ECPubKey.fromHex(hcpub)

      assert.equal(pub.toHex(), hcpub)
      assert.equal(pub.compressed, true)
    })

    it('using toHex should support uncompressed', function() {
      var pub = ECPubKey.fromHex(hpub)

      assert.equal(pub.toHex(), hpub)
      assert.equal(pub.compressed, false)
    })
  })
})
