var Wallet = require('../src/wallet.js')
var HDNode = require('../src/hdwallet.js')
var T = require('../src/transaction.js')
var Transaction = T.Transaction
var TransactionOut = T.TransactionOut
var Script = require('../src/script.js')
var convert = require('../src/convert.js')
var assert = require('assert')
var sinon = require('sinon')
var SHA256 = require('crypto-js/sha256')
var Crypto = require('crypto-js')

var fixtureTxes = require('./fixtures/mainnet_tx')
var fixtureTx1Hex = fixtureTxes.prevTx
var fixtureTx2Hex = fixtureTxes.tx

describe('Wallet', function() {
  var seed, wallet
  beforeEach(function(){
    seed = convert.wordArrayToBytes(SHA256("don't use a string seed like this in real life"))
    wallet = new Wallet(seed)
  })

  describe('constructor', function() {
    it('should be ok to call without new', function() {
      assert.ok(Wallet(seed) instanceof Wallet)
    })

    it('defaults to Bitcoin mainnet', function() {
      assert.equal(wallet.getMasterKey().network, 'mainnet')
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
        wallet = new Wallet(seed, {network: 'testnet'})
      })

      it('uses the network if specified', function() {
        assert.equal(wallet.getMasterKey().network, 'testnet')
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
      var wallet = new Wallet(seed, {network: 'testnet'})
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
      var wallet = new Wallet(seed, {network: 'testnet'})
      var expectedAddresses = ["mnXiDR4MKsFxcKJEZjx4353oXvo55iuptn"]

      assert.equal(wallet.generateChangeAddress(), expectedAddresses[0])
      assert.deepEqual(wallet.changeAddresses, expectedAddresses)
    })
  })

  describe('getPrivateKey', function(){
    it('returns the private key at the given index of external account', function(){
      var wallet = new Wallet(seed, {network: 'testnet'})

      assertEqual(wallet.getPrivateKey(0), wallet.getExternalAccount().derive(0).priv)
      assertEqual(wallet.getPrivateKey(1), wallet.getExternalAccount().derive(1).priv)
    })
  })

  describe('getInternalPrivateKey', function(){
    it('returns the private key at the given index of internal account', function(){
      var wallet = new Wallet(seed, {network: 'testnet'})

      assertEqual(wallet.getInternalPrivateKey(0), wallet.getInternalAccount().derive(0).priv)
      assertEqual(wallet.getInternalPrivateKey(1), wallet.getInternalAccount().derive(1).priv)
    })
  })

  describe('getPrivateKeyForAddress', function(){
    it('returns the private key for the given address', function(){
      var wallet = new Wallet(seed, {network: 'testnet'})
      wallet.generateChangeAddress()
      wallet.generateAddress()
      wallet.generateAddress()

      assertEqual(wallet.getPrivateKeyForAddress("n2fiWrHqD6GM5GiEqkbWAc6aaZQp3ba93X"),
                  wallet.getExternalAccount().derive(1).priv)
                  assertEqual(wallet.getPrivateKeyForAddress("mnXiDR4MKsFxcKJEZjx4353oXvo55iuptn"),
                              wallet.getInternalAccount().derive(0).priv)
    })

    it('raises an error when address is not found', function(){
      var wallet = new Wallet(seed, {network: 'testnet'})
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
        "hashLittleEndian":"c7b97b432e7b3a8e31d1a4a0fa326c8fb002d19f2da5fc4feaf9c43a2762406a",
        "outputIndex": 0,
        "address" : "1AZpKpcfCzKDUeTFBQUL4MokQai3m3HMXv",
        "value": 20000
      }
      expectedOutputKey = expectedUtxo.hash + ":" + expectedUtxo.outputIndex
    })

    function addUtxoToOutput(utxo){
      var key = utxo.hash + ":" + utxo.outputIndex
      wallet.outputs[key] = {
        receive: key,
        address: utxo.address,
        value: utxo.value
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

      it('excludes spent outputs', function(){
        addUtxoToOutput(expectedUtxo)
        addUtxoToOutput(utxo1)
        wallet.outputs[utxo1.hash + ':' + utxo1.outputIndex].spend = "sometxn:m"

        assert.equal(wallet.getBalance(), 20000)
      })
    })

    describe('getUnspentOutputs', function(){
      beforeEach(function(){
        addUtxoToOutput(expectedUtxo)
      })

      it('parses wallet outputs to the expect format', function(){
        assert.deepEqual(wallet.getUnspentOutputs(), [expectedUtxo])
      })

      it('excludes spent outputs', function(){
        wallet.outputs[expectedOutputKey].spend = "sometxn:m"
        assert.deepEqual(wallet.getUnspentOutputs(), [])
      })
    })

    describe('setUnspentOutputs', function(){
      var utxo
      beforeEach(function(){
        utxo = cloneObject([expectedUtxo])
      })

      it('uses hashLittleEndian when hash is not present', function(){
        delete utxo[0]['hash']

        wallet.setUnspentOutputs(utxo)
        verifyOutputs()
      })

      it('uses hash when hashLittleEndian is not present', function(){
        delete utxo[0]['hashLittleEndian']

        wallet.setUnspentOutputs(utxo)
        verifyOutputs()
      })

      it('uses hash when both hash and hashLittleEndian are present', function(){
        wallet.setUnspentOutputs(utxo)
        verifyOutputs()
      })

      describe('required fields', function(){
        it("throws an error when hash and hashLittleEndian are both missing", function(){
          delete utxo[0]['hash']
          delete utxo[0]['hashLittleEndian']

          assert.throws(function() {
            wallet.setUnspentOutputs(utxo)
          }, /Invalid unspent output: key hash\(or hashLittleEndian\) is missing/)
        });

        ['outputIndex', 'address', 'value'].forEach(function(field){
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

    describe('setUnspentOutputsAsync', function(){
      var utxo
      beforeEach(function(){
        utxo = cloneObject([expectedUtxo])
      })

      afterEach(function(){
        wallet.setUnspentOutputs.restore()
      })

      it('calls setUnspentOutputs', function(done){
        sinon.stub(wallet, "setUnspentOutputs")

        var callback = function(){
          assert(wallet.setUnspentOutputs.calledWith(utxo))
          done()
        }

        wallet.setUnspentOutputsAsync(utxo, callback)
      })

      it('when setUnspentOutputs throws an error, it invokes callback with error', function(done){
        sinon.stub(wallet, "setUnspentOutputs").throws()

        var callback = function(err){
          assert(err instanceof Error)
          done()
        }
        wallet.setUnspentOutputsAsync(utxo, callback)
      })
    })
  })

  describe('processTx', function(){
    var tx

    beforeEach(function(){
      tx = Transaction.deserialize(fixtureTx1Hex)
    })

    describe("when tx outs contains an address owned by the wallet, an 'output' gets added to wallet.outputs", function(){
      it("works for receive address", function(){
        var totalOuts = outputCount()
        wallet.addresses = [tx.outs[0].address.toString()]

        wallet.processTx(tx)

        assert.equal(outputCount(), totalOuts + 1)
        verifyOutputAdded(0)
      })

      it("works for change address", function(){
        var totalOuts = outputCount()
        wallet.changeAddresses = [tx.outs[1].address.toString()]

        wallet.processTx(tx)

        assert.equal(outputCount(), totalOuts + 1)
        verifyOutputAdded(1)
      })

      function outputCount(){
        return Object.keys(wallet.outputs).length
      }

      function verifyOutputAdded(index) {
        var txOut = tx.outs[index]
        var key = convert.bytesToHex(tx.getHash()) + ":" + index
        var output = wallet.outputs[key]
        assert.equal(output.receive, key)
        assert.equal(output.value, txOut.value)
        assert.equal(output.address, txOut.address)
      }
    })

    describe("when tx ins outpoint contains a known txhash:i, the corresponding 'output' gets updated", function(){
      beforeEach(function(){
        wallet.addresses = [tx.outs[0].address.toString()] // the address fixtureTx2 used as input
        wallet.processTx(tx)

        tx = Transaction.deserialize(fixtureTx2Hex)
      })

      it("does not add to wallet.outputs", function(){
        var outputs = wallet.outputs
        wallet.processTx(tx)
        assert.deepEqual(wallet.outputs, outputs)
      })

      it("sets spend with the transaction hash and input index", function(){
        wallet.processTx(tx)

        var txIn = tx.ins[0]
        var key = txIn.outpoint.hash + ":" + txIn.outpoint.index
        var output = wallet.outputs[key]

        assert.equal(output.spend, convert.bytesToHex(tx.getHash()) + ':' + 0)
      })
    })

    it("does nothing when none of the involved addresses belong to the wallet", function(){
      var outputs = wallet.outputs
      wallet.processTx(tx)
      assert.deepEqual(wallet.outputs, outputs)
    })
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
          "hash": fakeTxHash(1),
          "outputIndex": 0,
          "address" : address1,
          "value": 400000 // not enough for value
        },
        {
          "hash": fakeTxHash(2),
          "outputIndex": 1,
          "address" : address1,
          "value": 500000 // enough for only value
        },
        {
          "hash": fakeTxHash(3),
          "outputIndex": 0,
          "address" : address2,
          "value": 520000 // enough for value and fee
        }
      ]
      wallet.setUnspentOutputs(utxo)
    })

    describe('choosing utxo', function(){
      it('calculates fees', function(){
        var tx = wallet.createTx(to, value)

        assert.equal(tx.ins.length, 1)
        assert.deepEqual(tx.ins[0].outpoint, { hash: fakeTxHash(3), index: 0 })
      })

      it('allows fee to be specified', function(){
        var fee = 30000
        var tx = wallet.createTx(to, value, fee)

        assert.equal(tx.ins.length, 2)
        assert.deepEqual(tx.ins[0].outpoint, { hash: fakeTxHash(3), index: 0 })
        assert.deepEqual(tx.ins[1].outpoint, { hash: fakeTxHash(2), index: 1 })
      })

      it('allows fee to be set to zero', function(){
        value = 520000
        var fee = 0
        var tx = wallet.createTx(to, value, fee)

        assert.equal(tx.ins.length, 1)
        assert.deepEqual(tx.ins[0].outpoint, { hash: fakeTxHash(3), index: 0 })
      })

      it('ignores spent outputs', function(){
        utxo.push(
          {
            "hash": fakeTxHash(4),
            "outputIndex": 0,
            "address" : address2,
            "value": 530000 // enough but spent before createTx
          }
        )
        wallet.setUnspentOutputs(utxo)
        wallet.outputs[fakeTxHash(4) + ":" + 0].spend = fakeTxHash(5) + ":" + 0

        var tx = wallet.createTx(to, value)

        assert.equal(tx.ins.length, 1)
        assert.deepEqual(tx.ins[0].outpoint, { hash: fakeTxHash(3), index: 0 })
      })
    })

    describe('transaction outputs', function(){
      it('includes the specified address and amount', function(){
        var tx = wallet.createTx(to, value)

        assert.equal(tx.outs.length, 1)
        var out = tx.outs[0]
        assert.equal(out.address, to)
        assert.equal(out.value, value)
      })

      describe('change', function(){
        it('uses the last change address if there is any', function(){
          var fee = 5000
          wallet.generateChangeAddress()
          wallet.generateChangeAddress()
          var tx = wallet.createTx(to, value, fee)

          assert.equal(tx.outs.length, 2)
          var out = tx.outs[1]
          assert.equal(out.address, wallet.changeAddresses[1])
          assert.equal(out.value, 15000)
        })

        it('generates a change address if there is not any', function(){
          var fee = 5000
          assert.equal(wallet.changeAddresses.length, 0)

          var tx = wallet.createTx(to, value, fee)

          assert.equal(wallet.changeAddresses.length, 1)
          var out = tx.outs[1]
          assert.equal(out.address, wallet.changeAddresses[0])
          assert.equal(out.value, 15000)
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
        var value = 5430

        assert.throws(function() {
          wallet.createTx(to, value)
        }, /Value must be above dust threshold/)
      })
    })

    describe('when there is not enough money', function(){
      it('throws an error', function(){
        var value = 1400001

        assert.throws(function() {
          wallet.createTx(to, value)
        }, /Not enough money to send funds including transaction fee. Have: 1420000, needed: 1420001/)
      })
    })

    function fakeTxHash(i) {
      return "txtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtxtx" + i
    }
  })

  describe('createTxAsync', function(){
    var to, value, fee

    beforeEach(function(){
      to = '15mMHKL96tWAUtqF3tbVf99Z8arcmnJrr3'
      value = 500000
      fee = 10000
    })

    afterEach(function(){
      wallet.createTx.restore()
    })

    it('calls createTx', function(done){
      sinon.stub(wallet, "createTx").returns("fakeTx")

      var callback = function(err, tx){
        assert(wallet.createTx.calledWith(to, value))
        assert.equal(err, null)
        assert.equal(tx, "fakeTx")
        done()
      }

      wallet.createTxAsync(to, value, callback)
    })

    it('calls createTx correctly when fee is specified', function(done){
      sinon.stub(wallet, "createTx").returns("fakeTx")

      var callback = function(err, tx){
        assert(wallet.createTx.calledWith(to, value, fee))
        assert.equal(err, null)
        assert.equal(tx, "fakeTx")
        done()
      }

      wallet.createTxAsync(to, value, fee, callback)
    })

    it('when createTx throws an error, it invokes callback with error', function(done){
      sinon.stub(wallet, "createTx").throws()

      var callback = function(err, tx){
        assert(err instanceof Error)
        done()
      }

      wallet.createTxAsync(to, value, callback)
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
