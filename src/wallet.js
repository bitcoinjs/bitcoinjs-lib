Bitcoin.Wallet = (function () {
  var Script = Bitcoin.Script,
  TransactionIn = Bitcoin.TransactionIn,
  TransactionOut = Bitcoin.TransactionOut;

  var Wallet = function () {
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
      if (!(key instanceof Bitcoin.ECKey)) {
        key = new Bitcoin.ECKey(key);
      }
      keys.push(key);

      if (pub) {
        if ("string" === typeof pub) {
          pub = Crypto.util.base64ToBytes(pub);
        }
        key.setPub(pub);
      }

      this.addressHashes.push(key.getBitcoinAddress().getHashBase64());
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
        addresses.push(keys[i].getBitcoinAddress());
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
      this.addressPointer++;
      if (!keys[this.addressPointer]) {
        this.generateAddress();
      }
      return keys[this.addressPointer].getBitcoinAddress();
    };

    /**
     * Sign a hash with a key.
     *
     * This method expects the pubKeyHash as the first parameter and the hash
     * to be signed as the second parameter.
     */
    this.signWithKey = function (pubKeyHash, hash) {
      pubKeyHash = Crypto.util.bytesToBase64(pubKeyHash);
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
      pubKeyHash = Crypto.util.bytesToBase64(pubKeyHash);
      for (var i = 0; i < this.addressHashes.length; i++) {
        if (this.addressHashes[i] == pubKeyHash) {
          return keys[i].getPub();
        }
      }
      throw new Error("Hash unknown");
    };
  };

  Wallet.prototype.generateAddress = function () {
    this.addKey(new Bitcoin.ECKey());
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
    for (j = 0; j < tx.outs.length; j++) {
      var txout = new TransactionOut(tx.outs[j]);
      hash = Crypto.util.bytesToBase64(txout.script.simpleOutPubKeyHash());
      for (k = 0; k < this.addressHashes.length; k++) {
        if (this.addressHashes[k] === hash) {
          this.unspentOuts.push({tx: tx, index: j, out: txout});
          break;
        }
      }
    }

    // Remove spent outputs
    for (j = 0; j < tx.ins.length; j++) {
      var txin = new TransactionIn(tx.ins[j]);
      var pubkey = txin.script.simpleInPubKey();
      hash = Crypto.util.bytesToBase64(Bitcoin.Util.sha256ripe160(pubkey));
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
      balance = balance.add(Bitcoin.Util.valueToBigInt(txout.value));
    }
    return balance;
  };

  Wallet.prototype.createSend = function (address, sendValue, feeValue) {
    var selectedOuts = [];
    var txValue = sendValue.add(feeValue);
    var availableValue = BigInteger.ZERO;
    var i;
    for (i = 0; i < this.unspentOuts.length; i++) {
      selectedOuts.push(this.unspentOuts[i]);
      availableValue = availableValue.add(Bitcoin.Util.valueToBigInt(this.unspentOuts[i].out.value));

      if (availableValue.compareTo(txValue) >= 0) break;
    }

    if (availableValue.compareTo(txValue) < 0) {
      throw new Error('Insufficient funds.');
    }


    var changeValue = availableValue.subtract(txValue);

    var sendTx = new Bitcoin.Transaction();

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

  return Wallet;
})();

