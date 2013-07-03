var Script = require('./script');
var ECKey = require('./eckey');
var conv = require('./convert');
var util = require('./util');

var BigInteger = require('./jsbn/jsbn');

var Transaction = require('./transaction').Transaction;
var TransactionIn = require('./transaction').TransactionIn;
var TransactionOut = require('./transaction').TransactionOut;

var Wallet = function (bitcoinNetwork) {
  // Keychain
  //
  // The keychain is stored as a var in this closure to make accidental
  // serialization less likely.
  //
  // Any functions accessing this value therefore have to be defined in
  // the closure of this constructor.
  var keys = [];

  // Public hashes of our keys
  this.addressHashes = [];
  this.bitcoinNetwork = bitcoinNetwork;

  // Transaction data
  this.txIndex = {};
  this.unspentOuts = [];

  // Other fields
  this.addressPointer = 0;

  /**
   * Add a key to the keychain.
   *
   * The corresponding public key can be provided as a second parameter. This
   * adds it to the cache in the ECKey object and avoid the need to
   * expensively calculate it later.
   */
  this.addKey = function (key, pub) {
    if (!(key instanceof ECKey)) {
      key = new ECKey(key);
    }
    keys.push(key);

    if (pub) {
      if ("string" === typeof pub) {
        pub = Crypto.util.base64ToBytes(pub);
      }
      key.setPub(pub);
    }

    this.addressHashes.push(key.getBitcoinAddress(this.bitcoinNetwork).getHashBase64());
  };

  /**
   * Add multiple keys at once.
   */
  this.addKeys = function (keys, pubs) {
    if ("string" === typeof keys) {
      keys = keys.split(',');
    }
    if ("string" === typeof pubs) {
      pubs = pubs.split(',');
    }
    var i;
    if (Array.isArray(pubs) && keys.length == pubs.length) {
      for (i = 0; i < keys.length; i++) {
        this.addKey(keys[i], pubs[i]);
      }
    } else {
      for (i = 0; i < keys.length; i++) {
        this.addKey(keys[i]);
      }
    }
  };

  /**
   * Get the key chain.
   *
   * Returns an array of base64-encoded private values.
   */
  this.getKeys = function () {
    var serializedWallet = [];

    for (var i = 0; i < keys.length; i++) {
      serializedWallet.push(keys[i].toString('base64'));
    }

    return serializedWallet;
  };

  /**
   * Get the public keys.
   *
   * Returns an array of base64-encoded public keys.
   */
  this.getPubKeys = function () {
    var pubs = [];

    for (var i = 0; i < keys.length; i++) {
      pubs.push(Crypto.util.bytesToBase64(keys[i].getPub()));
    }

    return pubs;
  };

  /**
   * Delete all keys.
   */
  this.clear = function () {
    keys = [];
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
      addresses.push(keys[i].getBitcoinAddress(this.bitcoinNetwork));
    }
    return addresses;
  };

  this.getCurAddress = function () {
    if (keys[this.addressPointer]) {
      return keys[this.addressPointer].getBitcoinAddress();
    } else {
      return null;
    }
  };

  /**
   * Go to the next address.
   *
   * If there are no more new addresses available, one will be generated
   * automatically.
   */
  this.getNextAddress = function () {
    if (keys.length === 0) {
      this.generateAddress();
    }

    /*
    this.addressPointer++;
    if (!keys[this.addressPointer]) {
      this.generateAddress();
    }
    */
    // TODO(shtylman) this shit is trying to be too smart
    // it is making a new address when it shouldn't
    // it should just stop being so "smart" and just do what it is told
    return keys[this.addressPointer].getBitcoinAddress(this.bitcoinNetwork);
  };

  /**
   * Sign a hash with a key.
   *
   * This method expects the pubKeyHash as the first parameter and the hash
   * to be signed as the second parameter.
   */
  this.signWithKey = function (pubKeyHash, hash) {
    pubKeyHash = conv.bytesToBase64(pubKeyHash);
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
    pubKeyHash = conv.bytesToBase64(pubKeyHash);
    for (var i = 0; i < this.addressHashes.length; i++) {
      if (this.addressHashes[i] == pubKeyHash) {
        return keys[i].getPub();
      }
    }
    throw new Error("Hash unknown");
  };
};

Wallet.prototype.generateAddress = function () {
  this.addKey(new ECKey());
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
    // this hash is the base64 hash of the pubkey which is the address the output when to
    hash = conv.bytesToBase64(txout.script.simpleOutPubKeyHash());
    for (k = 0; k < this.addressHashes.length; k++) {
      // if our address, then we add the unspent out to a list of unspent outputs
      if (this.addressHashes[k] === hash) {
        this.unspentOuts.push({tx: tx, index: j, out: txout});
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
    hash = conv.bytesToBase64(util.sha256ripe160(pubkey));
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
  var balance = BigInteger.valueOf(0);
  for (var i = 0; i < this.unspentOuts.length; i++) {
    var txout = this.unspentOuts[i].out;
    balance = balance.add(util.valueToBigInt(txout.value));
  }
  return balance;
};

Wallet.prototype.createSend = function (address, sendValue, feeValue) {
  var selectedOuts = [];
  var txValue = sendValue.add(feeValue);
  var availableValue = BigInteger.ZERO;
  var i;
  for (i = 0; i < this.unspentOuts.length; i++) {
    var txout = this.unspentOuts[i];
    selectedOuts.push(txout);
    availableValue = availableValue.add(util.valueToBigInt(txout.out.value));

    if (availableValue.compareTo(txValue) >= 0) break;
  }

  if (availableValue.compareTo(txValue) < 0) {
    throw new Error('Insufficient funds.');
  }

  var changeValue = availableValue.subtract(txValue);

  var sendTx = new Transaction();

  for (i = 0; i < selectedOuts.length; i++) {
    sendTx.addInput(selectedOuts[i].tx, selectedOuts[i].index);
  }

  sendTx.addOutput(address, sendValue);
  if (changeValue.compareTo(BigInteger.ZERO) > 0) {
    sendTx.addOutput(this.getNextAddress(), changeValue);
  }

  var hashType = 1; // SIGHASH_ALL

  for (i = 0; i < sendTx.ins.length; i++) {
    var hash = sendTx.hashTransactionForSignature(selectedOuts[i].out.script, i, hashType);
    var pubKeyHash = selectedOuts[i].out.script.simpleOutPubKeyHash();

    // this changes because signing uses a random number generator
    var signature = this.signWithKey(pubKeyHash, hash);

    // Append hash type
    signature.push(parseInt(hashType, 10));

    sendTx.ins[i].script = Script.createInputScript(signature, this.getPubKeyFromHash(pubKeyHash));
  }

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
  if (Bitcoin.Util.isArray(hash)) hash = Crypto.util.bytesToBase64(hash);

  // TODO: Just create an object with  base64 hashes as keys for faster lookup
  for (var k = 0; k < this.addressHashes.length; k++) {
    if (this.addressHashes[k] === hash) return true;
  }
  return false;
};

module.exports = Wallet;
