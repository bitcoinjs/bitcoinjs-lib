(function () {
  var Opcode = Bitcoin.Opcode;

  // Make opcodes available as pseudo-constants
  for (var i in Opcode.map) {
    eval("var " + i + " = " + Opcode.map[i] + ";");
  }

  var Script = Bitcoin.Script = function (data) {
    if (!data) {
      this.buffer = [];
    } else if ("string" == typeof data) {
      this.buffer = Crypto.util.base64ToBytes(data);
    } else if (Bitcoin.Util.isArray(data)) {
      this.buffer = data;
    } else if (data instanceof Script) {
      this.buffer = data.buffer;
    } else {
      throw new Error("Invalid script");
    }

    this.parse();
  };

  /**
   * Update the parsed script representation.
   *
   * Each Script object stores the script in two formats. First as a raw byte
   * array and second as an array of "chunks", such as opcodes and pieces of
   * data.
   *
   * This method updates the chunks cache. Normally this is called by the
   * constructor and you don't need to worry about it. However, if you change
   * the script buffer manually, you should update the chunks using this method.
   */
  Script.prototype.parse = function () {
    var self = this;

    this.chunks = [];

    // Cursor
    var i = 0;

    // Read n bytes and store result as a chunk
    function readChunk(n) {
      self.chunks.push(self.buffer.slice(i, i + n));
      i += n;
    };

    while (i < this.buffer.length) {
      var opcode = this.buffer[i++];
      if (opcode >= 0xF0) {
        // Two byte opcode
        opcode = (opcode << 8) | this.buffer[i++];
      }

      var len;
      if (opcode > 0 && opcode < OP_PUSHDATA1) {
        // Read some bytes of data, opcode value is the length of data
        readChunk(opcode);
      } else if (opcode == OP_PUSHDATA1) {
        len = this.buffer[i++];
        readChunk(len);
      } else if (opcode == OP_PUSHDATA2) {
        len = (this.buffer[i++] << 8) | this.buffer[i++];
        readChunk(len);
      } else if (opcode == OP_PUSHDATA4) {
        len = (this.buffer[i++] << 24) |
          (this.buffer[i++] << 16) |
          (this.buffer[i++] << 8) |
          this.buffer[i++];
        readChunk(len);
      } else {
        this.chunks.push(opcode);
      }
    }
  };

  /**
   * Compare the script to known templates of scriptPubKey.
   *
   * This method will compare the script to a small number of standard script
   * templates and return a string naming the detected type.
   *
   * Currently supported are:
   * Address:
   *   Paying to a Bitcoin address which is the hash of a pubkey.
   *   OP_DUP OP_HASH160 [pubKeyHash] OP_EQUALVERIFY OP_CHECKSIG
   *
   * Pubkey:
   *   Paying to a public key directly.
   *   [pubKey] OP_CHECKSIG
   * 
   * Strange:
   *   Any other script (no template matched).
   */
  Script.prototype.getOutType = function () {

  if (this.chunks[this.chunks.length-1] == OP_CHECKMULTISIG && this.chunks[this.chunks.length-2] <= 3) {
    // Transfer to M-OF-N
    return 'Multisig';
  } else if (this.chunks.length == 5 &&
    this.chunks[0] == OP_DUP &&
    this.chunks[1] == OP_HASH160 &&
    this.chunks[3] == OP_EQUALVERIFY &&
    this.chunks[4] == OP_CHECKSIG) {
    // Transfer to Bitcoin address
    return 'Address';
  } else if (this.chunks.length == 2 &&
         this.chunks[1] == OP_CHECKSIG) {
    // Transfer to IP address
    return 'Pubkey';
  } else {
    return 'Strange';
  }   
}

  /**
   * Returns the affected address hash for this output.
   *
   * For standard transactions, this will return the hash of the pubKey that
   * can spend this output.
   *
   * In the future, for payToScriptHash outputs, this will return the
   * scriptHash. Note that non-standard and standard payToScriptHash transactions
   * look the same 
   *
   * This method is useful for indexing transactions.
   */
  Script.prototype.simpleOutHash = function ()
  {
    switch (this.getOutType()) {
    case 'Address':
      return this.chunks[2];
    case 'Pubkey':
      return Bitcoin.Util.sha256ripe160(this.chunks[0]);
    default:
      throw new Error("Encountered non-standard scriptPubKey");
    }
  };

  /**
   * Old name for Script#simpleOutHash.
   *
   * @deprecated
   */
  Script.prototype.simpleOutPubKeyHash = Script.prototype.simpleOutHash;

  /**
   * Compare the script to known templates of scriptSig.
   *
   * This method will compare the script to a small number of standard script
   * templates and return a string naming the detected type.
   *
   * WARNING: Use this method with caution. It merely represents a heuristic
   * based on common transaction formats. A non-standard transaction could
   * very easily match one of these templates by accident.
   *
   * Currently supported are:
   * Address:
   *   Paying to a Bitcoin address which is the hash of a pubkey.
   *   [sig] [pubKey]
   *
   * Pubkey:
   *   Paying to a public key directly.
   *   [sig]
   * 
   * Strange:
   *   Any other script (no template matched).
   */
  Script.prototype.getInType = function ()
  {
    if (this.chunks.length == 1 &&
        Bitcoin.Util.isArray(this.chunks[0])) {
      // Direct IP to IP transactions only have the signature in their scriptSig.
      // TODO: We could also check that the length of the data is correct.
      return 'Pubkey';
    } else if (this.chunks.length == 2 &&
               Bitcoin.Util.isArray(this.chunks[0]) &&
               Bitcoin.Util.isArray(this.chunks[1])) {
      return 'Address';
    } else {
      return 'Strange';
    }
  };

  /**
   * Returns the affected public key for this input.
   *
   * This currently only works with payToPubKeyHash transactions. It will also
   * work in the future for standard payToScriptHash transactions that use a
   * single public key.
   *
   * However for multi-key and other complex transactions, this will only return
   * one of the keys or raise an error. Therefore, it is recommended for indexing
   * purposes to use Script#simpleInHash or Script#simpleOutHash instead.
   *
   * @deprecated
   */
  Script.prototype.simpleInPubKey = function ()
  {
    switch (this.getInType()) {
    case 'Address':
      return this.chunks[1];
    case 'Pubkey':
      // TODO: Theoretically, we could recover the pubkey from the sig here.
      //       See https://bitcointalk.org/?topic=6430.0
      throw new Error("Script does not contain pubkey.");
    default:
      throw new Error("Encountered non-standard scriptSig");
    }
  };

  /**
   * Returns the affected address hash for this input.
   *
   * For standard transactions, this will return the hash of the pubKey that
   * can spend this output.
   *
   * In the future, for standard payToScriptHash inputs, this will return the
   * scriptHash.
   *
   * Note: This function provided for convenience. If you have the corresponding
   * scriptPubKey available, you are urged to use Script#simpleOutHash instead
   * as it is more reliable for non-standard payToScriptHash transactions.
   *
   * This method is useful for indexing transactions.
   */
  Script.prototype.simpleInHash = function ()
  {
    return Bitcoin.Util.sha256ripe160(this.simpleInPubKey());
  };

  /**
   * Old name for Script#simpleInHash.
   *
   * @deprecated
   */
  Script.prototype.simpleInPubKeyHash = Script.prototype.simpleInHash;

  /**
   * Add an op code to the script.
   */
  Script.prototype.writeOp = function (opcode)
  {
    this.buffer.push(opcode);
    this.chunks.push(opcode);
  };

  /**
   * Add a data chunk to the script.
   */
  Script.prototype.writeBytes = function (data)
  {
    if (data.length < OP_PUSHDATA1) {
      this.buffer.push(data.length);
    } else if (data.length <= 0xff) {
      this.buffer.push(OP_PUSHDATA1);
      this.buffer.push(data.length);
    } else if (data.length <= 0xffff) {
      this.buffer.push(OP_PUSHDATA2);
      this.buffer.push(data.length & 0xff);
      this.buffer.push((data.length >>> 8) & 0xff);
    } else {
      this.buffer.push(OP_PUSHDATA4);
      this.buffer.push(data.length & 0xff);
      this.buffer.push((data.length >>> 8) & 0xff);
      this.buffer.push((data.length >>> 16) & 0xff);
      this.buffer.push((data.length >>> 24) & 0xff);
    }
    this.buffer = this.buffer.concat(data);
    this.chunks.push(data);
  };

  /**
   * Create a standard payToPubKeyHash output.
   */
  Script.createOutputScript = function (address)
  {
    var script = new Script();
    script.writeOp(OP_DUP);
    script.writeOp(OP_HASH160);
    script.writeBytes(address.hash);
    script.writeOp(OP_EQUALVERIFY);
    script.writeOp(OP_CHECKSIG);
    return script;
  };
  
  
  /**
   * Extract bitcoin addresses from an output script
   */
  Script.prototype.extractAddresses = function (addresses)
  { 
    switch (this.getOutType()) {
    case 'Address':
      addresses.push(new Address(this.chunks[2]));
      return 1;
    case 'Pubkey':
      addresses.push(new Address(Util.sha256ripe160(this.chunks[0])));
      return 1;
    case 'Multisig':
      for (var i = 1; i < this.chunks.length-2; ++i) {
        addresses.push(new Address(Util.sha256ripe160(this.chunks[i])));
      }
      return this.chunks[0] - OP_1 + 1;
    default:
      throw new Error("Encountered non-standard scriptPubKey");
    }
  };

  /**
   * Create an m-of-n output script
   */
  Script.createMultiSigOutputScript = function (m, pubkeys)
  {
    var script = new Bitcoin.Script();
    
    script.writeOp(OP_1 + m - 1);
    
    for (var i = 0; i < pubkeys.length; ++i) {
      script.writeBytes(pubkeys[i]);
    }
    
    script.writeOp(OP_1 + pubkeys.length - 1);

    script.writeOp(OP_CHECKMULTISIG);

    return script;
  };

  /**
   * Create a standard payToPubKeyHash input.
   */
  Script.createInputScript = function (signature, pubKey)
  {
    var script = new Script();
    script.writeBytes(signature);
    script.writeBytes(pubKey);
    return script;
  };

  Script.prototype.clone = function ()
  {
    return new Script(this.buffer);
  };
})();
