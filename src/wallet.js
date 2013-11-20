var Script = require('./script');
var ECKey = require('./eckey');
var conv = require('./convert');
var util = require('./util');

var BigInteger = require('./jsbn/jsbn');

var BIP32key = require('./bip32');

var Transaction = require('./transaction').Transaction;
var TransactionIn = require('./transaction').TransactionIn;
var TransactionOut = require('./transaction').TransactionOut;

var SecureRandom = require('./jsbn/rng');
var rng = new SecureRandom();

var Wallet = function () {
  // Keychain
  //
  // The keychain is stored as a var in this closure to make accidental
  // serialization less likely.
  //
  // Any functions accessing this value therefore have to be defined in
  // the closure of this constructor.
  var keys = [];
  var masterkey = null;

  // Public hashes of our keys
  this.addressHashes = [];

  // Transaction data
  this.txIndex = {};
  this.unspentOuts = [];

  // Other fields
  this.addressPointer = 0;
  
  this.genMasterkey = function(seed) {
    if (!seed) {
        var seedBytes = new Array(32);
        rng.nextBytes(seedBytes);
        seed = conv.bytesToString(seedBytes)
    }
    masterkey = new BIP32key(seed);
  }

  this.generateAddress = function() {
    keys.push(masterkey.ckd(keys.length))
  }

  /**
   * Get the key chain.
   *
   * Returns an array of hex-encoded private values.
   */
  this.getKeys = function () {
    var keyExport = [];

    for (var i = 0; i < keys.length; i++) {
      keyExport.push(keys[i].toString());
    }

    return keyExport;
  };

  this.privateSerialize = function() {
    return {
        masterkey: masterkey,
        keys: this.getKeys()
    }
  }

  /**
   * Get the public keys.
   *
   * Returns an array of hex-encoded public keys.
   */
  this.getPubKeys = function () {
    var pubs = [];

    for (var i = 0; i < keys.length; i++) {
      pubs.push(conv.bytesToHex(keys[i].getPub()));
    }

    return pubs;
  };

  /**
   * Delete all keys.
   */
  this.clear = function () {
    keys = [];
    masterkey = null;
  };

  /**
   * Return the number of keys in this wallet.
   */
  this.getLength = function () {
    return keys.length;
  };

  /**
   * Get the addresses for this wallet.
   *
   * Returns an array of Address objects.
   */
  this.getAllAddresses = function () {
    var addresses = [];
    for (var i = 0; i < keys.length; i++) {
      addresses.push(keys[i].getBitcoinAddress());
    }
    return addresses;
  };

  this.getCurAddress = function () {
    if (keys[keys.length - 1]) {
      return keys[keys.length - 1].getBitcoinAddress();
    } else {
      return null;
    }
  };

  /**
   * Sign a hash with a key.
   *
   * This method expects the pubKeyHash as the first parameter and the hash
   * to be signed as the second parameter.
   */
  this.signWithKey = function (pubKeyHash, hash) {
    pubKeyHash = conv.bytesToHex(pubKeyHash);
    for (var i = 0; i < this.addressHashes.length; i++) {
      if (this.addressHashes[i] == pubKeyHash) {
        return keys[i].sign(hash);
      }
    }
    throw new Error("Missing key for signature");
  };

  /**
   * Retrieve the corresponding pubKey for a pubKeyHash.
   *
   * This function only works if the pubKey in question is part of this
   * wallet.
   */
  this.getPubKeyFromHash = function (pubKeyHash) {
    pubKeyHash = conv.bytesToHex(pubKeyHash);
    for (var i = 0; i < this.addressHashes.length; i++) {
      if (this.addressHashes[i] == pubKeyHash) {
        return keys[i].getPub();
      }
    }
    throw new Error("Hash unknown");
  };
};

// return unspent transactions
Wallet.prototype.unspentTx = function() {
  return this.unspentOuts;
};

/**
 * Add a transaction to the wallet's processed transaction.
 *
 * This will add a transaction to the wallet, updating its balance and
 * available unspent outputs.
 */
Wallet.prototype.process = function (tx) {
  if (this.txIndex[tx.hash]) return;

  var j;
  var k;
  var hash;
  // Gather outputs
  for (j = 0; j < tx.out.length; j++) {
    var raw_tx = tx.out[j];
    var txout = new TransactionOut(raw_tx);
    // this hash is the hash of the pubkey which is the address the output when to
    hash = conv.bytesToHex(txout.script.simpleOutPubKeyHash());
    for (k = 0; k < this.addressHashes.length; k++) {
      // if our address, then we add the unspent out to a list of unspent outputs
      if (this.addressHashes[k] === hash) {
        this.unspentOuts.push({tx: tx, index: j, output: txout});
        break;
      }
    }
  }

  // Remove spent outputs
  for (j = 0; j < tx.in.length; j++) {
    var raw_tx = tx.in[j];

    // mangle into the format TransactionIn expects
    raw_tx.outpoint = {
      hash: raw_tx.prev_out.hash,
      index: raw_tx.prev_out.n
    };

    var txin = new TransactionIn(raw_tx);
    var pubkey = txin.script.simpleInPubKey();
    hash = conv.bytesToHex(util.sha256ripe160(pubkey));
    for (k = 0; k < this.addressHashes.length; k++) {
      if (this.addressHashes[k] === hash) {
        for (var l = 0; l < this.unspentOuts.length; l++) {
          if (txin.outpoint.hash == this.unspentOuts[l].tx.hash &&
              txin.outpoint.index == this.unspentOuts[l].index) {
            this.unspentOuts.splice(l, 1);
          }
        }
        break;
      }
    }
  }

  // Index transaction
  this.txIndex[tx.hash] = tx;
};

Wallet.prototype.getBalance = function () {
    return this.unspentOuts.reduce(function(t,o) { return t + o.output.value },0);
};

Wallet.prototype.createSend = function (address, sendValue, feeValue) {
  var selectedOuts = [];
  var txValue = sendValue + feeValue;
  var availableValue = 0;
  var i;
  for (i = 0; i < this.unspentOuts.length; i++) {
    var txout = this.unspentOuts[i];
    selectedOuts.push(txout);
    availableValue += txout.output.value;

    if (availableValue >= txValue) break;
  }

  if (availableValue < txValue) {
    throw new Error('Insufficient funds.');
  }

  var changeValue = availableValue - txValue;

  var sendTx = new Transaction();

  for (i = 0; i < selectedOuts.length; i++) {
    sendTx.addInput(selectedOuts[i].tx, selectedOuts[i].index);
  }

  sendTx.addOutput(address, sendValue);
  if (changeValue > 0) {
    sendTx.addOutput(this.getCurAddress(), changeValue);
  }

  var hashType = 1; // SIGHASH_ALL

  sendTx.signWithKeys(this.getKeys(), selectedOuts, hashType)

  return sendTx;
};

Wallet.prototype.clearTransactions = function () {
  this.txIndex = {};
  this.unspentOuts = [];
};

/**
 * Check to see if a pubKeyHash belongs to this wallet.
 */
Wallet.prototype.hasHash = function (hash) {
  if (util.isArray(hash)) hash = conv.bytesToHex(hash);

  // TODO: Just create an object with hashes as keys for faster lookup
  for (var k = 0; k < this.addressHashes.length; k++) {
    if (this.addressHashes[k] === hash) return true;
  }
  return false;
};

module.exports = Wallet;
