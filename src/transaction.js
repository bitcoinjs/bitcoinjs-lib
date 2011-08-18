(function () {
	var Script = Bitcoin.Script;

	var Transaction = Bitcoin.Transaction = function (doc) {
		this.version = 1;
		this.lock_time = 0;
		this.ins = [];
		this.outs = [];
		this.timestamp = null;
		this.block = null;

		if (doc) {
			if (doc.hash) this.hash = doc.hash;
			if (doc.version) this.version = doc.version;
			if (doc.lock_time) this.lock_time = doc.lock_time;
			if (doc.ins && doc.ins.length) {
				for (var i = 0; i < doc.ins.length; i++) {
					this.addInput(new TransactionIn(doc.ins[i]));
				}
			}
			if (doc.outs && doc.outs.length) {
				for (var i = 0; i < doc.outs.length; i++) {
					this.addOutput(new TransactionOut(doc.outs[i]));
				}
			}
			if (doc.timestamp) this.timestamp = doc.timestamp;
			if (doc.block) this.block = doc.block;
		}
	};

	Transaction.objectify = function (txs) {
		var objs = [];
		for (var i = 0; i < txs.length; i++) {
			objs.push(new Transaction(txs[i]));
		}
		return objs;
	};

	Transaction.prototype.addInput = function (tx, outIndex) {
		if (arguments[0] instanceof TransactionIn) {
			this.ins.push(arguments[0]);
		} else {
			this.ins.push(new TransactionIn({
				outpoint: {
					hash: tx.hash,
					index: outIndex
				},
				script: new Bitcoin.Script(),
				sequence: 4294967295
			}));
		}
	};

	Transaction.prototype.addOutput = function (address, value) {
		if (arguments[0] instanceof TransactionOut) {
			this.outs.push(arguments[0]);
		} else {
			if (value instanceof BigInteger) {
				value = value.toByteArrayUnsigned().reverse();
				while (value.length < 8) value.push(0);
			} else if (Bitcoin.Util.isArray(value)) {
				// Nothing to do
			}

			this.outs.push(new TransactionOut({
				value: value,
				script: Script.createOutputScript(address)
			}));
		}
	};

	Transaction.prototype.serialize = function ()
	{
		var buffer = [];
		buffer = buffer.concat(Crypto.util.wordsToBytes([parseInt(this.version)]).reverse());
		buffer = buffer.concat(Bitcoin.Util.numToVarInt(this.ins.length));
		for (var i = 0; i < this.ins.length; i++) {
			var txin = this.ins[i];
			buffer = buffer.concat(Crypto.util.base64ToBytes(txin.outpoint.hash));
			buffer = buffer.concat(Crypto.util.wordsToBytes([parseInt(txin.outpoint.index)]).reverse());
			var scriptBytes = txin.script.buffer;
			buffer = buffer.concat(Bitcoin.Util.numToVarInt(scriptBytes.length));
			buffer = buffer.concat(scriptBytes);
			buffer = buffer.concat(Crypto.util.wordsToBytes([parseInt(txin.sequence)]).reverse());
		}
		buffer = buffer.concat(Bitcoin.Util.numToVarInt(this.outs.length));
		for (var i = 0; i < this.outs.length; i++) {
			var txout = this.outs[i];
			buffer = buffer.concat(txout.value);
			var scriptBytes = txout.script.buffer;
			buffer = buffer.concat(Bitcoin.Util.numToVarInt(scriptBytes.length));
			buffer = buffer.concat(scriptBytes);
		}
		buffer = buffer.concat(Crypto.util.wordsToBytes([parseInt(this.lock_time)]).reverse());

		return buffer;
	};

	var OP_CODESEPARATOR = 171;

	var SIGHASH_ALL = 1;
	var SIGHASH_NONE = 2;
	var SIGHASH_SINGLE = 3;
	var SIGHASH_ANYONECANPAY = 80;

	Transaction.prototype.hashTransactionForSignature = function (connectedScript, inIndex, hashType)
	{
		var txTmp = this.clone();

		// In case concatenating two scripts ends up with two codeseparators,
		// or an extra one at the end, this prevents all those possible incompatibilities.
		/*scriptCode = scriptCode.filter(function (val) {
			return val !== OP_CODESEPARATOR;
		});*/

		// Blank out other inputs' signatures
		for (var i = 0; i < txTmp.ins.length; i++) {
    		txTmp.ins[i].script = new Script();
		}

		txTmp.ins[inIndex].script = connectedScript;

		// Blank out some of the outputs
		if ((hashType & 0x1f) == SIGHASH_NONE) {
    		txTmp.outs = [];

			// Let the others update at will
			for (var i = 0; i < txTmp.ins.length; i++)
				if (i != inIndex)
					txTmp.ins[i].sequence = 0;
		} else if ((hashType & 0x1f) == SIGHASH_SINGLE) {
			// TODO: Implement
		}

		// Blank out other inputs completely, not recommended for open transactions
		if (hashType & SIGHASH_ANYONECANPAY) {
			txTmp.ins = [txTmp.ins[inIndex]];
		}

    console.log(txTmp);
		var buffer = txTmp.serialize();

		buffer = buffer.concat(Crypto.util.wordsToBytes([parseInt(hashType)]).reverse());

		console.log("signtx: "+Crypto.util.bytesToHex(buffer));

		var hash1 = Crypto.SHA256(buffer, {asBytes: true});

		console.log("sha256_1: ", Crypto.util.bytesToHex(hash1));

		return Crypto.SHA256(hash1, {asBytes: true});
	};

	Transaction.prototype.getHash = function ()
	{
		var buffer = this.serialize();
		return Crypto.SHA256(Crypto.SHA256(buffer, {asBytes: true}), {asBytes: true});
	};

	Transaction.prototype.clone = function ()
	{
		var newTx = new Transaction();
		newTx.version = this.version;
		newTx.lock_time = this.lock_time;
		for (var i = 0; i < this.ins.length; i++) {
			var txin = this.ins[i].clone();
			newTx.addInput(txin);
		}
		for (var i = 0; i < this.outs.length; i++) {
			var txout = this.outs[i].clone();
			newTx.addOutput(txout);
		}
		return newTx;
	};

  /**
   * Analyze how this transaction affects a wallet.
   */
	Transaction.prototype.analyze = function (wallet) {
		if (!(wallet instanceof Bitcoin.Wallet)) return null;

		var allFromMe = true,
		    allToMe = true,
		    firstRecvHash = null,
		    firstMeRecvHash = null,
		    firstSendHash = null;

		for (var i = this.outs.length-1; i >= 0; i--) {
			var txout = this.outs[i];
			var hash = txout.script.simpleOutPubKeyHash();
			if (!wallet.hasHash(hash)) {
				allToMe = false;
			} else {
				firstMeRecvHash = hash;
			}
			firstRecvHash = hash;
		}
		for (var i = this.ins.length-1; i >= 0; i--) {
			var txin = this.ins[i];
			firstSendHash = txin.script.simpleInPubKeyHash();
			if (!wallet.hasHash(firstSendHash)) {
				allFromMe = false;
				break;
			}
		}

		var impact = this.calcImpact(wallet);

    var analysis = {};

    analysis.impact = impact;

		if (impact.sign > 0 && impact.value.compareTo(BigInteger.ZERO) > 0) {
			analysis.type = 'recv';
      analysis.addr = new Bitcoin.Address(firstMeRecvHash);
		} else if (allFromMe && allToMe) {
      analysis.type = 'self';
		} else if (allFromMe) {
      analysis.type = 'sent';
      analysis.addr = new Bitcoin.Address(firstRecvHash);
		} else  {
			analysis.type = "other";
		}

    return analysis;
  };

	Transaction.prototype.getDescription = function (wallet) {
    var analysis = this.analyze(wallet);

    if (!analysis) return "";

    switch (analysis.type) {
    case 'recv':
      return "Received with "+analysis.addr;
      break;

    case 'sent':
			return "Payment to "+analysis.addr;
      break;

    case 'self':
			return "Payment to yourself";
      break;

    case 'other':
    default:
      return "";
    }
	};

	Transaction.prototype.getTotalValue = function () {
		var totalValue = BigInteger.ZERO;
		for (var j = 0; j < this.outs.length; j++) {
			var txout = this.outs[j];
			totalValue = totalValue.add(Bitcoin.Util.valueToBigInt(txout.value));
		}
		return totalValue;
	};

	/**
	 * Calculates the impact a transaction has on this wallet.
	 *
	 * Based on the its public keys, the wallet will calculate the
	 * credit or debit of this transaction.
	 *
	 * It will return an object with two properties:
	 *  - sign: 1 or -1 depending on sign of the calculated impact.
	 *  - value: amount of calculated impact
	 *
	 * @returns Object Impact on wallet
	 */
	Transaction.prototype.calcImpact = function (wallet) {
		if (!(wallet instanceof Bitcoin.Wallet)) return BigInteger.ZERO;

		// Calculate credit to us from all outputs
		var valueOut = BigInteger.ZERO;
		for (var j = 0; j < this.outs.length; j++) {
			var txout = this.outs[j];
			var hash = Crypto.util.bytesToBase64(txout.script.simpleOutPubKeyHash());
			if (wallet.hasHash(hash)) {
				valueOut = valueOut.add(Bitcoin.Util.valueToBigInt(txout.value));
			}
		}

		// Calculate debit to us from all ins
		var valueIn = BigInteger.ZERO;
		for (var j = 0; j < this.ins.length; j++) {
			var txin = this.ins[j];
			var hash = Crypto.util.bytesToBase64(txin.script.simpleInPubKeyHash());
			if (wallet.hasHash(hash)) {
				var fromTx = wallet.txIndex[txin.outpoint.hash];
				if (fromTx) {
					valueIn = valueIn.add(Bitcoin.Util.valueToBigInt(fromTx.outs[txin.outpoint.index].value));
				}
			}
		}
		if (valueOut.compareTo(valueIn) >= 0) {
			return {
				sign: 1,
				value: valueOut.subtract(valueIn)
			};
		} else {
			return {
				sign: -1,
				value: valueIn.subtract(valueOut)
			};
		}
	};

	var TransactionIn = Bitcoin.TransactionIn = function (data)
	{
		this.outpoint = data.outpoint;
		if (data.script instanceof Script) {
			this.script = data.script;
		} else {
			this.script = new Script(data.script);
		}
		this.sequence = data.sequence;
	};

	TransactionIn.prototype.clone = function ()
	{
		var newTxin = new TransactionIn({
			outpoint: {
				hash: this.outpoint.hash,
				index: this.outpoint.index
			},
			script: this.script.clone(),
			sequence: this.sequence
		});
		return newTxin;
	};

	var TransactionOut = Bitcoin.TransactionOut = function (data)
	{
		if (data.script instanceof Script) {
			this.script = data.script;
		} else {
			this.script = new Script(data.script);
		}

		if (Bitcoin.Util.isArray(data.value)) {
			this.value = data.value;
		} else if ("string" == typeof data.value) {
			var valueHex = (new BigInteger(data.value, 10)).toString(16);
			while (valueHex.length < 16) valueHex = "0" + valueHex;
			this.value = Crypto.util.hexToBytes(valueHex);
		}
	};

	TransactionOut.prototype.clone = function ()
	{
		var newTxout = new TransactionOut({
			script: this.script.clone(),
			value: this.value.slice(0)
		});
		return newTxout;
	};
})();


