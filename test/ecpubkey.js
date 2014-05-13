var assert = require('assert')

var ECPubKey = require('..').ECPubKey

describe('ECPubKey', function() {
  describe('toBuffer/toHex', function() {
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

  describe('getAddress', function() {
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
})
