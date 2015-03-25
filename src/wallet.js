var assert = require('assert')
var bufferutils = require('./bufferutils')
var typeForce = require('typeforce')
var networks = require('./networks')
var randomBytes = require('randombytes')

var Address = require('./address')
var HDNode = require('./hdnode')
var TransactionBuilder = require('./transaction_builder')
var Script = require('./script')

function Wallet (seed, network) {
  console.warn('Wallet is deprecated and will be removed in 2.0.0, see #296')

  seed = seed || randomBytes(32)
  network = network || networks.bitcoin

  // Stored in a closure to make accidental serialization less likely
  var masterKey = HDNode.fromSeedBuffer(seed, network)

  // HD first-level child derivation method should be hardened
  // See https://bitcointalk.org/index.php?topic=405179.msg4415254#msg4415254
  var accountZero = masterKey.deriveHardened(0)
  var externalAccount = accountZero.derive(0)
  var internalAccount = accountZero.derive(1)

  this.addresses = []
  this.changeAddresses = []
  this.network = network
  this.unspents = []

  // FIXME: remove in 2.0.0
  this.unspentMap = {}

  // FIXME: remove in 2.0.0
  var me = this
  this.newMasterKey = function (seed) {
    console.warn('newMasterKey is deprecated, please make a new Wallet instance instead')

    seed = seed || randomBytes(32)
    masterKey = HDNode.fromSeedBuffer(seed, network)

    accountZero = masterKey.deriveHardened(0)
    externalAccount = accountZero.derive(0)
    internalAccount = accountZero.derive(1)

    me.addresses = []
    me.changeAddresses = []

    me.unspents = []
    me.unspentMap = {}
  }

  this.getMasterKey = function () {
    return masterKey
  }
  this.getAccountZero = function () {
    return accountZero
  }
  this.getExternalAccount = function () {
    return externalAccount
  }
  this.getInternalAccount = function () {
    return internalAccount
  }
}

Wallet.prototype.createTransaction = function (to, value, options) {
  // FIXME: remove in 2.0.0
  if (typeof options !== 'object') {
    if (options !== undefined) {
      console.warn('Non options object parameters are deprecated, use options object instead')

      options = {
        fixedFee: arguments[2],
        changeAddress: arguments[3]
      }
    }
  }

  options = options || {}

  assert(value > this.network.dustThreshold, value + ' must be above dust threshold (' + this.network.dustThreshold + ' Satoshis)')

  var changeAddress = options.changeAddress
  var fixedFee = options.fixedFee
  var minConf = options.minConf === undefined ? 0 : options.minConf // FIXME: change minConf:1 by default in 2.0.0

  // filter by minConf, then pending and sort by descending value
  var unspents = this.unspents.filter(function (unspent) {
    return unspent.confirmations >= minConf
  }).filter(function (unspent) {
    return !unspent.pending
  }).sort(function (o1, o2) {
    return o2.value - o1.value
  })

  var accum = 0
  var addresses = []
  var subTotal = value

  var txb = new TransactionBuilder()
  txb.addOutput(to, value)

  for (var i = 0; i < unspents.length; ++i) {
    var unspent = unspents[i]
    addresses.push(unspent.address)

    txb.addInput(unspent.txHash, unspent.index)

    var fee = fixedFee === undefined ? estimatePaddedFee(txb.buildIncomplete(), this.network) : fixedFee

    accum += unspent.value
    subTotal = value + fee

    if (accum >= subTotal) {
      var change = accum - subTotal

      if (change > this.network.dustThreshold) {
        txb.addOutput(changeAddress || this.getChangeAddress(), change)
      }

      break
    }
  }

  assert(accum >= subTotal, 'Not enough funds (incl. fee): ' + accum + ' < ' + subTotal)

  return this.signWith(txb, addresses).build()
}

// FIXME: remove in 2.0.0
Wallet.prototype.processPendingTx = function (tx) {
  this.__processTx(tx, true)
}

// FIXME: remove in 2.0.0
Wallet.prototype.processConfirmedTx = function (tx) {
  this.__processTx(tx, false)
}

// FIXME: remove in 2.0.0
Wallet.prototype.__processTx = function (tx, isPending) {
  console.warn('processTransaction is considered harmful, see issue #260 for more information')

  var txId = tx.getId()
  var txHash = tx.getHash()

  tx.outs.forEach(function (txOut, i) {
    var address

    try {
      address = Address.fromOutputScript(txOut.script, this.network).toString()
    } catch (e) {
      if (!(e.message.match(/has no matching Address/)))
        throw e
    }

    var myAddresses = this.addresses.concat(this.changeAddresses)
    if (myAddresses.indexOf(address) > -1) {
      var lookup = txId + ':' + i
      if (lookup in this.unspentMap) return

      // its unique, add it
      var unspent = {
        address: address,
        confirmations: 0, // no way to determine this without more information
        index: i,
        txHash: txHash,
        txId: txId,
        value: txOut.value,
        pending: isPending
      }

      this.unspentMap[lookup] = unspent
      this.unspents.push(unspent)
    }
  }, this)

  tx.ins.forEach(function (txIn) {
    // copy and convert to big-endian hex
    var txInId = bufferutils.reverse(txIn.hash).toString('hex')

    var lookup = txInId + ':' + txIn.index
    if (!(lookup in this.unspentMap)) return

    var unspent = this.unspentMap[lookup]

    if (isPending) {
      unspent.pending = true
      unspent.spent = true
    } else {
      delete this.unspentMap[lookup]

      this.unspents = this.unspents.filter(function (unspent2) {
        return unspent !== unspent2
      })
    }
  }, this)
}

Wallet.prototype.generateAddress = function () {
  var k = this.addresses.length
  var address = this.getExternalAccount().derive(k).getAddress()

  this.addresses.push(address.toString())

  return this.getReceiveAddress()
}

Wallet.prototype.generateChangeAddress = function () {
  var k = this.changeAddresses.length
  var address = this.getInternalAccount().derive(k).getAddress()

  this.changeAddresses.push(address.toString())

  return this.getChangeAddress()
}

Wallet.prototype.getAddress = function () {
  if (this.addresses.length === 0) {
    this.generateAddress()
  }

  return this.addresses[this.addresses.length - 1]
}

Wallet.prototype.getBalance = function (minConf) {
  minConf = minConf || 0

  return this.unspents.filter(function (unspent) {
    return unspent.confirmations >= minConf

      // FIXME: remove spent filter in 2.0.0
  }).filter(function (unspent) {
    return !unspent.spent
  }).reduce(function (accum, unspent) {
    return accum + unspent.value
  }, 0)
}

Wallet.prototype.getChangeAddress = function () {
  if (this.changeAddresses.length === 0) {
    this.generateChangeAddress()
  }

  return this.changeAddresses[this.changeAddresses.length - 1]
}

Wallet.prototype.getInternalPrivateKey = function (index) {
  return this.getInternalAccount().derive(index).privKey
}

Wallet.prototype.getPrivateKey = function (index) {
  return this.getExternalAccount().derive(index).privKey
}

Wallet.prototype.getPrivateKeyForAddress = function (address) {
  var index

  if ((index = this.addresses.indexOf(address)) > -1) {
    return this.getPrivateKey(index)
  }

  if ((index = this.changeAddresses.indexOf(address)) > -1) {
    return this.getInternalPrivateKey(index)
  }

  assert(false, 'Unknown address. Make sure the address is from the keychain and has been generated')
}

Wallet.prototype.getUnspentOutputs = function (minConf) {
  minConf = minConf || 0

  return this.unspents.filter(function (unspent) {
    return unspent.confirmations >= minConf

      // FIXME: remove spent filter in 2.0.0
  }).filter(function (unspent) {
    return !unspent.spent
  }).map(function (unspent) {
    return {
      address: unspent.address,
      confirmations: unspent.confirmations,
      index: unspent.index,
      txId: unspent.txId,
      value: unspent.value,

      // FIXME: remove in 2.0.0
      hash: unspent.txId,
      pending: unspent.pending
    }
  })
}

Wallet.prototype.setUnspentOutputs = function (unspents) {
  this.unspentMap = {}
  this.unspents = unspents.map(function (unspent) {
    // FIXME: remove unspent.hash in 2.0.0
    var txId = unspent.txId || unspent.hash
    var index = unspent.index

    // FIXME: remove in 2.0.0
    if (unspent.hash !== undefined) {
      console.warn('unspent.hash is deprecated, use unspent.txId instead')
    }

    // FIXME: remove in 2.0.0
    if (index === undefined) {
      console.warn('unspent.outputIndex is deprecated, use unspent.index instead')
      index = unspent.outputIndex
    }

    typeForce('String', txId)
    typeForce('Number', index)
    typeForce('Number', unspent.value)

    assert.equal(txId.length, 64, 'Expected valid txId, got ' + txId)
    assert.doesNotThrow(function () {
      Address.fromBase58Check(unspent.address)
    }, 'Expected Base58 Address, got ' + unspent.address)
    assert(isFinite(index), 'Expected finite index, got ' + index)

    // FIXME: remove branch in 2.0.0
    if (unspent.confirmations !== undefined) {
      typeForce('Number', unspent.confirmations)
    }

    var txHash = bufferutils.reverse(new Buffer(txId, 'hex'))

    unspent = {
      address: unspent.address,
      confirmations: unspent.confirmations || 0,
      index: index,
      txHash: txHash,
      txId: txId,
      value: unspent.value,

      // FIXME: remove in 2.0.0
      pending: unspent.pending || false
    }

    // FIXME: remove in 2.0.0
    this.unspentMap[txId + ':' + index] = unspent

    return unspent
  }, this)
}

Wallet.prototype.signWith = function (tx, addresses) {
  addresses.forEach(function (address, i) {
    var privKey = this.getPrivateKeyForAddress(address)

    tx.sign(i, privKey)
  }, this)

  return tx
}

function estimatePaddedFee (tx, network) {
  var tmpTx = tx.clone()
  tmpTx.addOutput(Script.EMPTY, network.dustSoftThreshold || 0)

  return network.estimateFee(tmpTx)
}

// FIXME: 1.0.0 shims, remove in 2.0.0
Wallet.prototype.getReceiveAddress = Wallet.prototype.getAddress
Wallet.prototype.createTx = Wallet.prototype.createTransaction

module.exports = Wallet
