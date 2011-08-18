Bitcoin.Wallet = (function () {
	var Script = Bitcoin.Script,
	    TransactionIn = Bitcoin.TransactionIn,
	    TransactionOut = Bitcoin.TransactionOut;

	var Wallet = function () {
		// Keychain
		var keys = [];
		this.addressHashes = [];

		// Transaction data
		this.txIndex = {};
		this.unspentOuts = [];

		// Other fields
		this.addressPointer = 0;

		this.addKey = function (key, pub) {
			if (!(key instanceof Bitcoin.ECKey)) {
				key = new Bitcoin.ECKey(key);
			}
			keys.push(key);

      if (pub) {
        if ("string" === typeof pub) {
          pub = Crypto.util.base64ToBytes(pub);
        }
        key.pub = pub;
      }

			this.addressHashes.push(key.getBitcoinAddress().getHashBase64());
		};

		this.addKeys = function (keys, pubs) {
      if ("string" === typeof keys) {
        keys = keys.split(',');
      }
      if ("string" === typeof pubs) {
        pubs = pubs.split(',');
      }
      console.log(pubs);
      if (Array.isArray(pubs) && keys.length == pubs.length) {
			  for (var i = 0; i < keys.length; i++) {
				  this.addKey(keys[i], pubs[i]);
        }
      } else {
			  for (var i = 0; i < keys.length; i++) {
				  this.addKey(keys[i]);
        }
      }
		};

		this.getKeys = function () {
			var serializedWallet = [];

			for (var i = 0; i < keys.length; i++) {
				serializedWallet.push(keys[i].toString('base64'));
			}

			return serializedWallet;
		};

    this.getPubKeys = function () {
			var pubs = [];

			for (var i = 0; i < keys.length; i++) {
				pubs.push(Crypto.util.bytesToBase64(keys[i].getPub()));
			}

			return pubs;
    };

		this.clear = function () {
			keys = [];
		};

    this.getLength = function () {
      return keys.length;
    };

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

		this.getNextAddress = function () {
			if (keys.length) {
				// TODO: Create new addresses if we run out
				this.addressPointer = (this.addressPointer + 1) % keys.length;
				return keys[this.addressPointer].getBitcoinAddress();
			} else {
				return null;
			}
		};

		this.signWithKey = function (pubKeyHash, hash) {
			pubKeyHash = Crypto.util.bytesToBase64(pubKeyHash);
			for (var i = 0; i < this.addressHashes.length; i++) {
				if (this.addressHashes[i] == pubKeyHash) {
					return keys[i].sign(hash);
				}
			}
			throw new Error("Missing key for signature");
		};

		this.getPubKeyFromHash = function (pubKeyHash) {
			pubKeyHash = Crypto.util.bytesToBase64(pubKeyHash);
			for (var i = 0; i < this.addressHashes.length; i++) {
				if (this.addressHashes[i] == pubKeyHash) {
					console.log(Crypto.util.bytesToBase64(Bitcoin.Util.sha256ripe160(keys[i].getPub())), pubKeyHash);
					return keys[i].getPub();
				}
			}
			throw new Error("Hash unknown");
		};
	};

	Wallet.prototype.generateAddress = function () {
		this.addKey(new Bitcoin.ECKey());
	};

	Wallet.prototype.process = function (tx) {
		if (this.txIndex[tx.hash]) return;

		// Gather outputs
		for (var j = 0; j < tx.outs.length; j++) {
			var txout = new TransactionOut(tx.outs[j]);
			var hash = Crypto.util.bytesToBase64(txout.script.simpleOutPubKeyHash());
			for (var k = 0; k < this.addressHashes.length; k++) {
				if (this.addressHashes[k] === hash) {
					this.unspentOuts.push({tx: tx, index: j, out: txout});
					break;
				}
			}
		}

		// Remove spent outputs
		for (var j = 0; j < tx.ins.length; j++) {
			var txin = new TransactionIn(tx.ins[j]);
			var pubkey = txin.script.simpleInPubKey();
			var hash = Crypto.util.bytesToBase64(Bitcoin.Util.sha256ripe160(pubkey));
			for (var k = 0; k < this.addressHashes.length; k++) {
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
		for (var i = 0; i < this.unspentOuts.length; i++) {
			selectedOuts.push(this.unspentOuts[i]);
			availableValue = availableValue.add(Bitcoin.Util.valueToBigInt(this.unspentOuts[i].out.value));

			if (availableValue.compareTo(txValue) >= 0) break;
		}

    if (availableValue.compareTo(txValue) < 0) {
      throw new Error('Insufficient funds.');
    }

		console.log(selectedOuts);

		var changeValue = availableValue.subtract(txValue);

		var sendTx = new Bitcoin.Transaction();

		for (var i = 0; i < selectedOuts.length; i++) {
			sendTx.addInput(selectedOuts[i].tx, selectedOuts[i].index);
		}

		sendTx.addOutput(address, sendValue);
		if (changeValue.compareTo(BigInteger.ZERO) > 0) {
			sendTx.addOutput(this.getNextAddress(), changeValue);
		}

		var hashType = 1; // SIGHASH_ALL

		for (var i = 0; i < sendTx.ins.length; i++) {
			var hash = sendTx.hashTransactionForSignature(selectedOuts[i].out.script, i, hashType);
			var pubKeyHash = selectedOuts[i].out.script.simpleOutPubKeyHash();
			var signature = this.signWithKey(pubKeyHash, hash);

			// Append hash type
			signature.push(parseInt(hashType));

			sendTx.ins[i].script = Script.createInputScript(signature, this.getPubKeyFromHash(pubKeyHash));
		}

		console.log(sendTx);

		console.log("pubkey: "+Crypto.util.bytesToHex(this.getPubKeyFromHash(pubKeyHash)));

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

