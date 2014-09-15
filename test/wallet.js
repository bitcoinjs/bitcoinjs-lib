var assert = require('assert')
var bufferutils = require('../src/bufferutils')
var crypto = require('../src/crypto')
var networks = require('../src/networks')
var sinon = require('sinon')

var Address = require('../src/address')
var HDNode = require('../src/hdnode')
var Transaction = require('../src/transaction')
var TransactionBuilder = require('../src/transaction_builder')
var Wallet = require('../src/wallet')

function fakeTxHash(i) {
  var hash = new Buffer(32)
  hash.fill(i)
  return hash
}

function fakeTxId(i) {
  var hash = fakeTxHash(i)
  Array.prototype.reverse.call(hash)
  return hash.toString('hex')
}

describe('Wallet', function() {
  var seed
  beforeEach(function() {
    seed = crypto.sha256("don't use a string seed like this in real life")
  })

  describe('constructor', function() {
    var wallet
    beforeEach(function() {
      wallet = new Wallet(seed)
    })

    it('defaults to Bitcoin network', function() {
      assert.equal(wallet.getMasterKey().network, networks.bitcoin)
    })

    it("generates m/0' as the main account", function() {
      var mainAccount = wallet.getAccountZero()
      assert.equal(mainAccount.index, 0 + HDNode.HIGHEST_BIT)
      assert.equal(mainAccount.depth, 1)
    })

    it("generates m/0'/0 as the external account", function() {
      var account = wallet.getExternalAccount()
      assert.equal(account.index, 0)
      assert.equal(account.depth, 2)
    })

    it("generates m/0'/1 as the internal account", function() {
      var account = wallet.getInternalAccount()
      assert.equal(account.index, 1)
      assert.equal(account.depth, 2)
    })

    describe('when seed is not specified', function() {
      it('generates a seed', function() {
        var wallet = new Wallet()
        assert(wallet.getMasterKey())
      })
    })

    describe('constructor options', function() {
      beforeEach(function() {
        wallet = new Wallet(seed, networks.testnet)
      })

      it('uses the network if specified', function() {
        assert.equal(wallet.getMasterKey().network, networks.testnet)
      })
    })
  })

  describe('generateAddress', function() {
    it('generate receiving addresses', function() {
      var wallet = new Wallet(seed, networks.testnet)
      var expectedAddresses = [
        "n1GyUANZand9Kw6hGSV9837cCC9FFUQzQa",
        "n2fiWrHqD6GM5GiEqkbWAc6aaZQp3ba93X"
      ]

      assert.equal(wallet.generateAddress(), expectedAddresses[0])
      assert.equal(wallet.generateAddress(), expectedAddresses[1])
      assert.deepEqual(wallet.addresses, expectedAddresses)
    })
  })

  describe('generateChangeAddress', function() {
    var wallet
    beforeEach(function() {
      wallet = new Wallet(seed)
    })

    it('generates change addresses', function() {
      var wallet = new Wallet(seed, networks.testnet)
      var expectedAddresses = ["mnXiDR4MKsFxcKJEZjx4353oXvo55iuptn"]

      assert.equal(wallet.generateChangeAddress(), expectedAddresses[0])
      assert.deepEqual(wallet.changeAddresses, expectedAddresses)
    })
  })

  describe('getPrivateKey', function() {
    var wallet
    beforeEach(function() {
      wallet = new Wallet(seed)
    })

    it('returns the private key at the given index of external account', function() {
      var wallet = new Wallet(seed, networks.testnet)

      assertEqual(wallet.getPrivateKey(0), wallet.getExternalAccount().derive(0).privKey)
      assertEqual(wallet.getPrivateKey(1), wallet.getExternalAccount().derive(1).privKey)
    })
  })

  describe('getInternalPrivateKey', function() {
    var wallet
    beforeEach(function() {
      wallet = new Wallet(seed)
    })

    it('returns the private key at the given index of internal account', function() {
      var wallet = new Wallet(seed, networks.testnet)

      assertEqual(wallet.getInternalPrivateKey(0), wallet.getInternalAccount().derive(0).privKey)
      assertEqual(wallet.getInternalPrivateKey(1), wallet.getInternalAccount().derive(1).privKey)
    })
  })

  describe('getPrivateKeyForAddress', function() {
    var wallet
    beforeEach(function() {
      wallet = new Wallet(seed)
    })

    it('returns the private key for the given address', function() {
      var wallet = new Wallet(seed, networks.testnet)
      wallet.generateChangeAddress()
      wallet.generateAddress()
      wallet.generateAddress()

      assertEqual(
        wallet.getPrivateKeyForAddress("n2fiWrHqD6GM5GiEqkbWAc6aaZQp3ba93X"),
        wallet.getExternalAccount().derive(1).privKey
      )
      assertEqual(
        wallet.getPrivateKeyForAddress("mnXiDR4MKsFxcKJEZjx4353oXvo55iuptn"),
        wallet.getInternalAccount().derive(0).privKey
      )
    })

    it('raises an error when address is not found', function() {
      var wallet = new Wallet(seed, networks.testnet)

      assert.throws(function() {
        wallet.getPrivateKeyForAddress("n2fiWrHqD6GM5GiEqkbWAc6aaZQp3ba93X")
      }, /Unknown address. Make sure the address is from the keychain and has been generated/)
    })
  })

  describe('Unspent Outputs', function() {
    var utxo, expectedOutputKey
    var wallet

    beforeEach(function() {
      utxo = {
        "address" : "1AZpKpcfCzKDUeTFBQUL4MokQai3m3HMXv",
        "confirmations": 1,
        "index": 0,
        "txId": fakeTxId(6),
        "value": 20000
      }
    })

    describe('on construction', function() {
      beforeEach(function() {
        wallet = new Wallet(seed, networks.bitcoin)
        wallet.setUnspentOutputs([utxo])
      })

      it('matches the expected behaviour', function() {
        var output = wallet.unspents[0]

        assert.equal(output.address, utxo.address)
        assert.equal(output.value, utxo.value)
      })
    })

    describe('getBalance', function() {
      beforeEach(function() {
        var utxo1 = cloneObject(utxo)
        utxo1.hash = fakeTxId(5)

        wallet = new Wallet(seed, networks.bitcoin)
        wallet.setUnspentOutputs([utxo, utxo1])
      })

      it('sums over utxo values', function() {
        assert.equal(wallet.getBalance(), 40000)
      })
    })

    describe('getUnspentOutputs', function() {
      beforeEach(function() {
        wallet = new Wallet(seed, networks.bitcoin)
        wallet.setUnspentOutputs([utxo])
      })

      it('parses wallet unspents to the expected format', function() {
        var outputs = wallet.getUnspentOutputs()
        var output = outputs[0]

        assert.equal(utxo.address, output.address)
        assert.equal(utxo.index, output.index)
        assert.equal(utxo.value, output.value)

        assert.equal(utxo.txId, output.txId)
        assert.equal(utxo.confirmations, output.confirmations)
      })
    })
  })

  describe('setUnspentOutputs', function() {
    var utxo
    var wallet

    beforeEach(function() {
      utxo = {
        txId: fakeTxId(0),
        index: 0,
        address: '115qa7iPZqn6as57hxLL8E9VUnhmGQxKWi',
        value: 500000,
        confirmations: 1
      }

      wallet = new Wallet(seed, networks.bitcoin)
    })

    it('matches the expected behaviour', function() {
      wallet.setUnspentOutputs([utxo])

      var output = wallet.unspents[0]
      assert.equal(output.value, utxo.value)
      assert.equal(output.address, utxo.address)
    })

    describe('required fields', function() {
      ['index', 'address', 'txId', 'value'].forEach(function(field){
        it("throws an error when " + field + " is missing", function() {
          delete utxo[field]

          assert.throws(function() {
            wallet.setUnspentOutputs([utxo])
          })
        })
      })
    })
  })

  describe('createTransaction', function() {
    var wallet
    var address1, address2
    var to, value

    beforeEach(function() {
      to = 'mt7MyTVVEWnbwpF5hBn6fgnJcv95Syk2ue'
      value = 500000

      address1 = "n1GyUANZand9Kw6hGSV9837cCC9FFUQzQa"
      address2 = "n2fiWrHqD6GM5GiEqkbWAc6aaZQp3ba93X"

      // set up 3 utxos
      var utxos = [
        {
          "txId": fakeTxId(1),
          "index": 0,
          "address": address1,
          "value": 400000, // not enough for value
          "confirmations": 1
        },
        {
          "txId": fakeTxId(2),
          "index": 1,
          "address": address1,
          "value": 500000, // enough for only value
          "confirmations": 1
        },
        {
          "txId": fakeTxId(3),
          "index": 0,
          "address" : address2,
          "value": 510000, // enough for value and fee
          "confirmations": 1
        }
      ]

      wallet = new Wallet(seed, networks.testnet)
      wallet.setUnspentOutputs(utxos)
      wallet.generateAddress()
      wallet.generateAddress()
    })

    describe('transaction fee', function() {
      it('allows fee to be specified', function() {
        var fee = 30000
        var tx = wallet.createTransaction(to, value, { fixedFee: fee })

        assert.equal(getFee(wallet, tx), fee)
      })

      it('allows fee to be set to zero', function() {
        value = 510000
        var fee = 0
        var tx = wallet.createTransaction(to, value, { fixedFee: fee })

        assert.equal(getFee(wallet, tx), fee)
      })

      it('does not overestimate fees when network has dustSoftThreshold', function() {
        var utxo = {
          txId: fakeTxId(0),
          index: 0,
          address: "LeyySKbQrRRwodKEj1W4a8y3YQupPLw5os",
          value: 500000,
          confirmations: 1
        }

        var wallet = new Wallet(seed, networks.litecoin)
        wallet.setUnspentOutputs([utxo])
        wallet.generateAddress()

        value = 200000
        var tx = wallet.createTransaction(utxo.address, value)

        assert.equal(getFee(wallet, tx), 100000)
      })

      function getFee(wallet, tx) {
        var valueMap = {}
        wallet.unspents.forEach(function(unspent) {
          valueMap[unspent.txId + ':' + unspent.index] = unspent.value
        })

        var inputValue = tx.ins.reduce(function(accum, input) {
          var txId = bufferutils.reverse(input.hash).toString('hex')

          return accum + valueMap[txId + ':' + input.index]
        }, 0)

        return tx.outs.reduce(function(accum, output) {
          return accum - output.value
        }, inputValue)
      }
    })

    describe('choosing utxo', function() {
      it('takes fees into account', function() {
        var tx = wallet.createTransaction(to, value)

        assert.equal(tx.ins.length, 1)
        assert.deepEqual(tx.ins[0].hash, fakeTxHash(3))
        assert.equal(tx.ins[0].index, 0)
      })

      it('uses only confirmed outputs', function() {
        var tx2 = new Transaction()
        tx2.addInput(fakeTxId(4), 0)
        tx2.addOutput(address2, 530000)

        wallet.setUnspentOutputs([
          {
            "txId": fakeTxId(1),
            "index": 0,
            "address" : address2,
            "value": 531000, // perfect amount w/ fees, but unconfirmed
            "confirmations": 0
          },
          {
            "txId": fakeTxId(3),
            "index": 0,
            "address": address1,
            "value": 300000,
            "confirmations": 1
          },
          {
            "txId": fakeTxId(3),
            "index": 1,
            "address": address2,
            "value": 300000,
            "confirmations": 1
          }
        ])

        var tx = wallet.createTransaction(to, value, {
          fixedFee: 1000
        })

        assert.equal(tx.ins.length, 2)
        assert.deepEqual(tx.ins[0].hash, fakeTxHash(3))
        assert.deepEqual(tx.ins[1].hash, fakeTxHash(3))
        assert.equal(tx.ins[0].index, 0)
        assert.equal(tx.ins[1].index, 1)
      })
    })

    describe('changeAddress', function() {
      it('should allow custom changeAddress', function() {
        var changeAddress = 'mfrFjnKZUvTcvdAK2fUX5D8v1Epu5H8JCk'
        var fromValue = 510000
        var toValue = fromValue / 2
        var fee = 1e3

        var tx = wallet.createTransaction(to, toValue, {
          fixedFee: fee,
          changeAddress: changeAddress
        })
        assert.equal(tx.outs.length, 2)

        var outAddress0 = Address.fromOutputScript(tx.outs[0].script, networks.testnet)
        var outAddress1 = Address.fromOutputScript(tx.outs[1].script, networks.testnet)

        assert.equal(outAddress0.toString(), to)
        assert.equal(tx.outs[0].value, toValue)

        assert.equal(outAddress1.toString(), changeAddress)
        assert.equal(tx.outs[1].value, fromValue - (toValue + fee))
      })
    })

    describe('transaction outputs', function() {
      it('includes the specified address and amount', function() {
        var tx = wallet.createTransaction(to, value)

        assert.equal(tx.outs.length, 1)
        var out = tx.outs[0]
        var outAddress = Address.fromOutputScript(out.script, networks.testnet)

        assert.equal(outAddress.toString(), to)
        assert.equal(out.value, value)
      })

      describe('change', function() {
        it('uses the last change address if there is any', function() {
          var fee = 0
          wallet.generateChangeAddress()
          wallet.generateChangeAddress()
          var tx = wallet.createTransaction(to, value, { fixedFee: fee })

          assert.equal(tx.outs.length, 2)
          var out = tx.outs[1]
          var outAddress = Address.fromOutputScript(out.script, networks.testnet)

          assert.equal(outAddress.toString(), wallet.changeAddresses[1])
          assert.equal(out.value, 10000)
        })

        it('generates a change address if there is not any', function() {
          var fee = 0
          assert.equal(wallet.changeAddresses.length, 0)

          var tx = wallet.createTransaction(to, value, { fixedFee: fee })

          assert.equal(wallet.changeAddresses.length, 1)
          var out = tx.outs[1]
          var outAddress = Address.fromOutputScript(out.script, networks.testnet)

          assert.equal(outAddress.toString(), wallet.changeAddresses[0])
          assert.equal(out.value, 10000)
        })

        it('skips change if it is not above dust threshold', function() {
          var tx1 = wallet.createTransaction(to, value - 546)
          assert.equal(tx1.outs.length, 1)

          var tx2 = wallet.createTransaction(to, value - 547)
          assert.equal(tx2.outs.length, 2)
        })
      })
    })

    describe('signing', function() {
      afterEach(function() {
        TransactionBuilder.prototype.sign.restore()
      })

      it('signs the inputs with respective keys', function() {
        var fee = 30000
        sinon.spy(TransactionBuilder.prototype, "sign")

        wallet.createTransaction(to, value, { fixedFee: fee })

        var priv1 = wallet.getPrivateKeyForAddress(address1)
        var priv2 = wallet.getPrivateKeyForAddress(address2)

        // FIXME: boo (required) side effects
        priv1.pub.Q.affineX, priv2.pub.Q.affineX

        assert(TransactionBuilder.prototype.sign.calledWith(0, priv2))
        assert(TransactionBuilder.prototype.sign.calledWith(1, priv1))
      })
    })

    describe('when value is below dust threshold', function() {
      it('throws an error', function() {
        var value = 546

        assert.throws(function() {
          wallet.createTransaction(to, value)
        }, /546 must be above dust threshold \(546 Satoshis\)/)
      })
    })

    describe('when there is not enough money', function() {
      it('throws an error', function() {
        var value = 1400001

        assert.throws(function() {
          wallet.createTransaction(to, value)
        }, /Not enough funds \(incl. fee\): 1410000 < 1410001/)
      })
    })
  })

  function assertEqual(obj1, obj2){
    assert.equal(obj1.toString(), obj2.toString())
  }

  function assertNotEqual(obj1, obj2){
    assert.notEqual(obj1.toString(), obj2.toString())
  }

  // quick and dirty: does not deal with functions on object
  function cloneObject(obj){
    return JSON.parse(JSON.stringify(obj))
  }
})
