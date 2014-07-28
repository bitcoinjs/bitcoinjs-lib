var assert = require('assert')
var crypto = require('../src/crypto')
var networks = require('../src/networks')
var sinon = require('sinon')
var scripts = require('../src/scripts')

var Address = require('../src/address')
var HDNode = require('../src/hdnode')
var Transaction = require('../src/transaction')
var Wallet = require('../src/wallet')

var fixtureTxes = require('./fixtures/mainnet_tx')
var fixtureTx1Hex = fixtureTxes.prevTx
var fixtureTx2Hex = fixtureTxes.tx

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
  var seed, wallet
  beforeEach(function(){
    seed = crypto.sha256("don't use a string seed like this in real life")
    wallet = new Wallet(seed)
  })

  describe('constructor', function() {
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

    describe('when seed is not specified', function(){
      it('generates a seed', function(){
        var wallet = new Wallet()
        assert.ok(wallet.getMasterKey())
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

  describe('newMasterKey', function(){
    it('resets accounts', function(){
      var wallet = new Wallet()
      var oldAccountZero = wallet.getAccountZero()
      var oldExternalAccount = wallet.getExternalAccount()
      var oldInternalAccount = wallet.getInternalAccount()

      wallet.newMasterKey(seed)
      assertNotEqual(wallet.getAccountZero(), oldAccountZero)
      assertNotEqual(wallet.getExternalAccount(), oldExternalAccount)
      assertNotEqual(wallet.getInternalAccount(), oldInternalAccount)
    })

    it('resets addresses', function(){
      var wallet = new Wallet()
      wallet.generateAddress()
      wallet.generateChangeAddress()
      var oldAddresses = wallet.addresses
      var oldChangeAddresses = wallet.changeAddresses
      assert.notDeepEqual(oldAddresses, [])
      assert.notDeepEqual(oldChangeAddresses, [])

      wallet.newMasterKey(seed)
      assert.deepEqual(wallet.addresses, [])
      assert.deepEqual(wallet.changeAddresses, [])
    })
  })

  describe('generateAddress', function(){
    it('generate receiving addresses', function(){
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

  describe('generateChangeAddress', function(){
    it('generates change addresses', function(){
      var wallet = new Wallet(seed, networks.testnet)
      var expectedAddresses = ["mnXiDR4MKsFxcKJEZjx4353oXvo55iuptn"]

      assert.equal(wallet.generateChangeAddress(), expectedAddresses[0])
      assert.deepEqual(wallet.changeAddresses, expectedAddresses)
    })
  })

  describe('getPrivateKey', function(){
    it('returns the private key at the given index of external account', function(){
      var wallet = new Wallet(seed, networks.testnet)

      assertEqual(wallet.getPrivateKey(0), wallet.getExternalAccount().derive(0).privKey)
      assertEqual(wallet.getPrivateKey(1), wallet.getExternalAccount().derive(1).privKey)
    })
  })

  describe('getInternalPrivateKey', function(){
    it('returns the private key at the given index of internal account', function(){
      var wallet = new Wallet(seed, networks.testnet)

      assertEqual(wallet.getInternalPrivateKey(0), wallet.getInternalAccount().derive(0).privKey)
      assertEqual(wallet.getInternalPrivateKey(1), wallet.getInternalAccount().derive(1).privKey)
    })
  })

  describe('getPrivateKeyForAddress', function(){
    it('returns the private key for the given address', function(){
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

    it('raises an error when address is not found', function(){
      var wallet = new Wallet(seed, networks.testnet)
      assert.throws(function() {
        wallet.getPrivateKeyForAddress("n2fiWrHqD6GM5GiEqkbWAc6aaZQp3ba93X")
      }, /Unknown address. Make sure the address is from the keychain and has been generated./)
    })
  })

  describe('Unspent Outputs', function(){
    var expectedUtxo, expectedOutputKey
    beforeEach(function(){
      expectedUtxo = {
        "hash":"6a4062273ac4f9ea4ffca52d9fd102b08f6c32faa0a4d1318e3a7b2e437bb9c7",
        "outputIndex": 0,
        "address" : "1AZpKpcfCzKDUeTFBQUL4MokQai3m3HMXv",
        "value": 20000,
        "pending": true
      }
      expectedOutputKey = expectedUtxo.hash + ":" + expectedUtxo.outputIndex
    })

    function addUtxoToOutput(utxo){
      var key = utxo.hash + ":" + utxo.outputIndex
      wallet.outputs[key] = {
        from: key,
        address: utxo.address,
        value: utxo.value,
        pending: utxo.pending
      }
    }

    describe('getBalance', function(){
      var utxo1

      beforeEach(function(){
        utxo1 = cloneObject(expectedUtxo)
        utxo1.hash = utxo1.hash.replace('7', 'l')
      })

      it('sums over utxo values', function(){
        addUtxoToOutput(expectedUtxo)
        addUtxoToOutput(utxo1)

        assert.equal(wallet.getBalance(), 40000)
      })
    })

    describe('getUnspentOutputs', function(){
      beforeEach(function(){
        addUtxoToOutput(expectedUtxo)
      })

      it('parses wallet outputs to the expect format', function(){
        assert.deepEqual(wallet.getUnspentOutputs(), [expectedUtxo])
      })

      it("ignores pending spending outputs (outputs with 'to' property)", function(){
        var output = wallet.outputs[expectedOutputKey]
        output.to = fakeTxId(0) + ':' + 0
        output.pending = true
        assert.deepEqual(wallet.getUnspentOutputs(), [])
      })
    })

    describe('setUnspentOutputs', function(){
      var utxo
      beforeEach(function(){
        utxo = cloneObject([expectedUtxo])
      })

      it('matches the expected behaviour', function(){
        wallet.setUnspentOutputs(utxo)
        verifyOutputs()
      })

      describe('required fields', function(){
        ['outputIndex', 'address', 'hash', 'value'].forEach(function(field){
          it("throws an error when " + field + " is missing", function(){
            delete utxo[0][field]

            assert.throws(function() {
              wallet.setUnspentOutputs(utxo)
            }, new RegExp('Invalid unspent output: key ' + field + ' is missing'))
          })
        })
      })

      function verifyOutputs() {
        var output = wallet.outputs[expectedOutputKey]
        assert(output)
        assert.equal(output.value, utxo[0].value)
        assert.equal(output.address, utxo[0].address)
      }
    })
  })

  describe('Process transaction', function(){
    var addresses
    var tx

    beforeEach(function(){
      addresses = [
        '115qa7iPZqn6as57hxLL8E9VUnhmGQxKWi',
        '1Bu3bhwRmevHLAy1JrRB6AfcxfgDG2vXRd',
        '1BBjuhF2jHxu7tPinyQGCuaNhEs6f5u59u'
      ]

      tx = Transaction.fromHex(fixtureTx1Hex)
    })

    describe("processPendingTx", function(){
      it("incoming: sets the pending flag on output", function(){
        wallet.addresses = [addresses[0]]
        wallet.processPendingTx(tx)

        verifyOutputAdded(0, true)
      })

      describe("when tx ins outpoint contains a known txhash:i", function(){
        var spendTx
        beforeEach(function(){
          wallet.addresses = [addresses[0]]
          wallet.processConfirmedTx(tx)

          spendTx = Transaction.fromHex(fixtureTx2Hex)
        })

        it("outgoing: sets the pending flag and 'to' on output", function(){
          var txIn = spendTx.ins[0]
          var txInId = new Buffer(txIn.hash)
          Array.prototype.reverse.call(txInId)
          txInId = txInId.toString('hex')

          var key = txInId + ':' + txIn.index
          assert(!wallet.outputs[key].pending)

          wallet.processPendingTx(spendTx)
          assert(wallet.outputs[key].pending)
          assert.equal(wallet.outputs[key].to, spendTx.getId() + ':' + 0)
        })
      })
    })

    describe('processConfirmedTx', function(){
      it('does not throw on scripts with no corresponding Address', function() {
        var pubKey = wallet.getPrivateKey(0).pub
        var script = scripts.pubKeyOutput(pubKey)
        var tx2 = new Transaction()

        tx2.addInput(fakeTxHash(1), 0)
        tx2.addOutput(script, 10000)

        wallet.processConfirmedTx(tx2)
      })

      describe("when tx outs contains an address owned by the wallet, an 'output' gets added to wallet.outputs", function(){
        it("works for receive address", function(){
          var totalOuts = outputCount()

          wallet.addresses = [addresses[0]]
          wallet.processConfirmedTx(tx)

          assert.equal(outputCount(), totalOuts + 1)
          verifyOutputAdded(0, false)
        })

        it("works for change address", function(){
          var totalOuts = outputCount()
          wallet.changeAddresses = [addresses[1]]

          wallet.processConfirmedTx(tx)

          assert.equal(outputCount(), totalOuts + 1)
          verifyOutputAdded(1, false)
        })

        function outputCount(){
          return Object.keys(wallet.outputs).length
        }
      })

      describe("when tx ins outpoint contains a known txhash:i", function(){
        var spendTx
        beforeEach(function(){
          wallet.addresses = [addresses[0]] // the address fixtureTx2 used as input
          wallet.processConfirmedTx(tx)

          spendTx = Transaction.fromHex(fixtureTx2Hex)
        })

        it("does not add to wallet.outputs", function(){
          wallet.processConfirmedTx(spendTx)
          assert.deepEqual(wallet.outputs, {})
        })

        it("deletes corresponding 'output'", function(){
          var txIn = spendTx.ins[0]
          var txInId = new Buffer(txIn.hash)
          Array.prototype.reverse.call(txInId)
          txInId = txInId.toString('hex')

          var expected = txInId + ':' + txIn.index
          assert(expected in wallet.outputs)

          wallet.processConfirmedTx(spendTx)
          assert(!(expected in wallet.outputs))
        })
      })

      it("does nothing when none of the involved addresses belong to the wallet", function(){
        wallet.processConfirmedTx(tx)
        assert.deepEqual(wallet.outputs, {})
      })
    })

    function verifyOutputAdded(index, pending) {
      var txOut = tx.outs[index]
      var key = tx.getId() + ":" + index
      var output = wallet.outputs[key]
      assert.equal(output.from, key)
      assert.equal(output.value, txOut.value)
      assert.equal(output.pending, pending)

      var txOutAddress = Address.fromOutputScript(txOut.script).toString()
      assert.equal(output.address, txOutAddress)
    }
  })

  describe('createTx', function(){
    var to, value
    var address1, address2

    beforeEach(function(){
      to = '15mMHKL96tWAUtqF3tbVf99Z8arcmnJrr3'
      value = 500000

      // generate 2 addresses
      address1 = wallet.generateAddress()
      address2 = wallet.generateAddress()

      // set up 3 utxo
      utxo = [
        {
          "hash": fakeTxId(1),
          "outputIndex": 0,
          "address" : address1,
          "value": 400000 // not enough for value
        },
        {
          "hash": fakeTxId(2),
          "outputIndex": 1,
          "address" : address1,
          "value": 500000 // enough for only value
        },
        {
          "hash": fakeTxId(3),
          "outputIndex": 0,
          "address" : address2,
          "value": 510000 // enough for value and fee
        }
      ]
      wallet.setUnspentOutputs(utxo)
    })

    describe('transaction fee', function(){
      it('allows fee to be specified', function(){
        var fee = 30000
        var tx = wallet.createTx(to, value, fee)

        assert.equal(getFee(wallet, tx), fee)
      })

      it('allows fee to be set to zero', function(){
        value = 510000
        var fee = 0
        var tx = wallet.createTx(to, value, fee)

        assert.equal(getFee(wallet, tx), fee)
      })

      it('does not overestimate fees when network has dustSoftThreshold', function(){
        var wallet = new Wallet(seed, networks.litecoin)
        var address = wallet.generateAddress()
        wallet.setUnspentOutputs([{
          hash: fakeTxId(0),
          outputIndex: 0,
          address: address,
          value: 500000
        }])

        value = 200000
        var tx = wallet.createTx(address, value)

        assert.equal(getFee(wallet, tx), 100000)
      })

      function getFee(wallet, tx) {
        var inputValue = tx.ins.reduce(function(memo, input){
          var id = Array.prototype.reverse.call(input.hash).toString('hex')
          return memo + wallet.outputs[id + ':' + input.index].value
        }, 0)

        return tx.outs.reduce(function(memo, output){
          return memo - output.value
        }, inputValue)
      }
    })

    describe('choosing utxo', function(){
      it('takes fees into account', function(){
        var tx = wallet.createTx(to, value)

        assert.equal(tx.ins.length, 1)
        assert.deepEqual(tx.ins[0].hash, fakeTxHash(3))
        assert.equal(tx.ins[0].index, 0)
      })

      it('ignores pending outputs', function(){
        utxo.push(
          {
            "hash": fakeTxId(4),
            "outputIndex": 0,
            "address" : address2,
            "value": 530000,
            "pending": true
          }
        )
        wallet.setUnspentOutputs(utxo)

        var tx = wallet.createTx(to, value)

        assert.equal(tx.ins.length, 1)
        assert.deepEqual(tx.ins[0].hash, fakeTxHash(3))
        assert.equal(tx.ins[0].index, 0)
      })
    })

    describe('works for testnet', function(){
      it('should create transaction', function(){
        var wallet = new Wallet(seed, networks.testnet)
        var address = wallet.generateAddress()

        wallet.setUnspentOutputs([{
          hash: fakeTxId(0),
          outputIndex: 0,
          address: address,
          value: value
        }])

        var to = 'mt7MyTVVEWnbwpF5hBn6fgnJcv95Syk2ue'
        var toValue = value - 10000

        var tx = wallet.createTx(to, toValue)
        assert.equal(tx.outs.length, 1)

        var outAddress = Address.fromOutputScript(tx.outs[0].script, networks.testnet)
        assert.equal(outAddress.toString(), to)
        assert.equal(tx.outs[0].value, toValue)
      })
    })

    describe('changeAddress', function(){
      it('should allow custom changeAddress', function(){
        var wallet = new Wallet(seed, networks.testnet)
        var address = wallet.generateAddress()

        wallet.setUnspentOutputs([{
          hash: fakeTxId(0),
          outputIndex: 0,
          address: address,
          value: value
        }])
        assert.equal(wallet.getBalance(), value)

        var changeAddress = 'mfrFjnKZUvTcvdAK2fUX5D8v1Epu5H8JCk'
        var to = 'mt7MyTVVEWnbwpF5hBn6fgnJcv95Syk2ue'
        var toValue = value / 2
        var fee = 1e3

        var tx = wallet.createTx(to, toValue, fee, changeAddress)
        assert.equal(tx.outs.length, 2)

        var outAddress0 = Address.fromOutputScript(tx.outs[0].script, networks.testnet)
        var outAddress1 = Address.fromOutputScript(tx.outs[1].script, networks.testnet)

        assert.equal(outAddress0.toString(), to)
        assert.equal(tx.outs[0].value, toValue)

        assert.equal(outAddress1.toString(), changeAddress)
        assert.equal(tx.outs[1].value, value - (toValue + fee))
      })
    })

    describe('transaction outputs', function(){
      it('includes the specified address and amount', function(){
        var tx = wallet.createTx(to, value)

        assert.equal(tx.outs.length, 1)
        var out = tx.outs[0]
        var outAddress = Address.fromOutputScript(out.script)

        assert.equal(outAddress.toString(), to)
        assert.equal(out.value, value)
      })

      describe('change', function(){
        it('uses the last change address if there is any', function(){
          var fee = 0
          wallet.generateChangeAddress()
          wallet.generateChangeAddress()
          var tx = wallet.createTx(to, value, fee)

          assert.equal(tx.outs.length, 2)
          var out = tx.outs[1]
          var outAddress = Address.fromOutputScript(out.script)

          assert.equal(outAddress.toString(), wallet.changeAddresses[1])
          assert.equal(out.value, 10000)
        })

        it('generates a change address if there is not any', function(){
          var fee = 0
          assert.equal(wallet.changeAddresses.length, 0)

          var tx = wallet.createTx(to, value, fee)

          assert.equal(wallet.changeAddresses.length, 1)
          var out = tx.outs[1]
          var outAddress = Address.fromOutputScript(out.script)

          assert.equal(outAddress.toString(), wallet.changeAddresses[0])
          assert.equal(out.value, 10000)
        })

        it('skips change if it is not above dust threshold', function(){
          var fee = 14570
          var tx = wallet.createTx(to, value)
          assert.equal(tx.outs.length, 1)
        })
      })
    })

    describe('signing', function(){
      afterEach(function(){
        Transaction.prototype.sign.restore()
      })

      it('signes the inputs with respective keys', function(){
        var fee = 30000
        sinon.stub(Transaction.prototype, "sign")

        var tx = wallet.createTx(to, value, fee)

        assert(Transaction.prototype.sign.calledWith(0, wallet.getPrivateKeyForAddress(address2)))
        assert(Transaction.prototype.sign.calledWith(1, wallet.getPrivateKeyForAddress(address1)))
      })
    })

    describe('when value is below dust threshold', function(){
      it('throws an error', function(){
        var value = 546

        assert.throws(function() {
          wallet.createTx(to, value)
        }, /546 must be above dust threshold \(546 Satoshis\)/)
      })
    })

    describe('when there is not enough money', function(){
      it('throws an error', function(){
        var value = 1400001

        assert.throws(function() {
          wallet.createTx(to, value)
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
