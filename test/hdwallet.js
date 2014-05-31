var assert = require('assert')
var networks = require('../src/networks')

var HDWallet = require('../src/hdwallet')
var fixtures = require('./fixtures/hdwallet.json')

function b2h(buf) {
  assert(Buffer.isBuffer(buf))
  return buf.toString('hex')
}

describe('HDWallet', function() {
  describe('toBase58', function() {
    it('reproduces input', function() {
      var input = 'xpub6D4BDPcP2GT577Vvch3R8wDkScZWzQzMMUm3PWbmWvVJrZwQY4VUNgqFJPMM3No2dFDFGTsxxpG5uJh7n7epu4trkrX7x7DogT5Uv6fcLW5'
      var output = HDWallet.fromBase58(input).toBase58(false)
      assert.equal(output, input)

      input = 'xprvA2JDeKCSNNZky6uBCviVfJSKyQ1mDYahRjijr5idH2WwLsEd4Hsb2Tyh8RfQMuPh7f7RtyzTtdrbdqqsunu5Mm3wDvUAKRHSC34sJ7in334'
      output = HDWallet.fromBase58(input).toBase58(true)
      assert.equal(output, input)
    })

    it('fails with priv=true when theres no private key', function() {
      var hd = HDWallet.fromBase58('xpub6DF8uhdarytz3FWdA8TvFSvvAh8dP3283MY7p2V4SeE2wyWmG5mg5EwVvmdMVCQcoNJxGoWaU9DCWh89LojfZ537wTfunKau47EL2dhHKon')
      try {
        hd.toBase58(true)
      } catch(e) {
        assert(e.message.match(/private key/i))
        return
      }
      assert.fail()
    })
  })

  describe('fromBase58', function() {
    fixtures.invalid.fromBase58.forEach(function(f) {
      it('throws on ' + f.string, function() {
        assert.throws(function() {
          HDWallet.fromBase58(f.string)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('constructor & seed deserialization', function() {
    var expectedPrivateKey = '0fd71c652e847ba7ea7956e3cf3fc0a0985871846b1b2c23b9c6a29a38cee860'
    var seed = new Buffer([
      99, 114, 97, 122, 121, 32, 104, 111, 114, 115, 101, 32, 98,
      97, 116, 116, 101, 114, 121, 32, 115, 116, 97, 112, 108, 101
    ])

    it('creates from binary seed', function() {
      var hd = new HDWallet(seed)

      assert.equal(hd.priv.D.toHex(), expectedPrivateKey)
      assert(hd.pub)
    })

    describe('fromSeedHex', function() {
      it('creates from hex seed', function() {
        var hd = HDWallet.fromSeedHex(seed.toString('hex'))

        assert.equal(hd.priv.D.toHex(), expectedPrivateKey)
        assert(hd.pub)
      })
    })

    describe('fromBuffer', function() {
      it('fails for invalid parent fingerprint', function() {
        var buffer = new HDWallet(seed).toBuffer()
        buffer.writeUInt8(0x00, 4)
        buffer.writeUInt32BE(0xFFFFFFFF, 5)
        assert.throws(function() { HDWallet.fromBuffer(buffer) }, /Invalid parent fingerprint/)
      })

      it('fails for invalid index', function() {
        var buffer = new HDWallet(seed).toBuffer()
        buffer.writeUInt32BE(0xFFFFFFFF, 9)
        assert.throws(function() { HDWallet.fromBuffer(buffer) }, /Invalid index/)
      })

      it('fails for an invalid network type', function() {
        var network = { bip32: { priv: 0x11111111, pub: 0x22222222 } }
        var buffer = new HDWallet(seed, network).toBuffer()

        assert.throws(function() {
          HDWallet.fromBuffer(buffer)
        }, /Could not find version 22222222/)
      })
    })
  })

  describe('Test vectors', function() {
    function verifyVector(hd, v) {
      assert.equal(b2h(hd.getIdentifier()), v.identifier)
      assert.equal(b2h(hd.getFingerprint()), v.fingerprint)
      assert.equal(hd.getAddress().toString(), v.address)
      assert.equal(hd.priv.toWIF(), v.wif)
      assert.equal(hd.pub.toHex(), v.pubKey)
      assert.equal(b2h(hd.chaincode), v.chaincode)
      assert.equal(hd.toHex(false), v.hex)
      assert.equal(hd.toHex(true), v.hexPriv)
      assert.equal(hd.toBase58(false), v.base58)
      assert.equal(hd.toBase58(true), v.base58Priv)
    }

    it('matches the test vectors', function() {
      fixtures.valid.forEach(function(f) {
        var hd = HDWallet.fromSeedHex(f.master.seed)
        verifyVector(hd, f.master)

        f.children.forEach(function(c) {
          // FIXME: c.description could be shown
          if (c.mPriv != undefined) {
            hd = hd.derivePrivate(c.mPriv)
          } else {
            hd = hd.derive(c.m)
          }

          verifyVector(hd, c)
        })
      })
    })
  })

  describe('derive', function() {
    describe('m/0', function() {
      var wallet = HDWallet.fromBase58('xpub6CxuB8ifZCMXeS3KbyNkYvrsJEHqxedCSiUhrNwH1nKtb8hcJpxDbDxkdoVCTR2bQ1G8hY4UMv85gef9SEpgFFUftBjt37FUSZxVx4AU9Qh').derive(0)

      it('derives the correct public key', function() {
        assert.equal(wallet.pub.toHex(), '02df843e6ae2017e0772d0584f76f56b8f2f5181a3045c7a7740a9d86dc7c80ce7')
      })

      it('derives the correct depth', function() {
        assert.equal(wallet.depth, 4)
      })
    })
  })

  describe('network types', function() {
    var seed

    beforeEach(function() {
      seed = new Buffer('foobar')
    })

    it('ensure that a bitcoin wallet is the default', function() {
      var wallet = new HDWallet(seed)

      assert.equal(wallet.network, networks.bitcoin)
    })

    it('ensures that a bitcoin Wallet generates bitcoin addresses', function() {
      var wallet = new HDWallet(seed)
      var address = wallet.getAddress().toString()

      assert.equal(address, '17SnB9hyGwJPoKpLb9eVPHjsujyEuBpMAA')
    })

    it('ensures that a testnet Wallet generates testnet addresses', function() {
      var wallet = new HDWallet(seed, networks.testnet)
      var address = wallet.getAddress().toString()

      assert.equal(address, 'mmxjUCnx5xjeaSHxJicsDCxCmjZwq8KTbv')
    })

    it('throws an exception when unknown network type is passed in', function() {
      assert.throws(function() {
        new HDWallet(seed, {})
      }, /Unknown BIP32 constants for network/)
    })
  })
})
