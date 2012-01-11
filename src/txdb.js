var TransactionDatabase = function () {
  this.txs = [];
  this.txIndex = {};
};

EventEmitter.augment(TransactionDatabase.prototype);

TransactionDatabase.prototype.addTransaction = function (tx) {
  this.addTransactionNoUpdate(tx);
  $(this).trigger('update');
};

TransactionDatabase.prototype.addTransactionNoUpdate = function (tx) {
  // Return if transaction is already known
  if (this.txIndex[tx.hash]) {
    return;
  }

  this.txs.push(new Bitcoin.Transaction(tx));
  this.txIndex[tx.hash] = tx;
};

TransactionDatabase.prototype.removeTransaction = function (hash) {
  this.removeTransactionNoUpdate(hash);
  $(this).trigger('update');
};

TransactionDatabase.prototype.removeTransactionNoUpdate = function (hash) {
  var tx = this.txIndex[hash];

  if (!tx) {
    // If the tx is not in the index, we don't actually waste our
    // time looping through the array.
    return;
  }

  for (var i = 0, l = this.txs.length; i < l; i++) {
    if (this.txs[i].hash == hash) {
      this.txs.splice(i, 1);
      break;
    }
  }

  delete this.txIndex[hash];
};

TransactionDatabase.prototype.loadTransactions = function (txs) {
  for (var i = 0; i < txs.length; i++) {
    this.addTransactionNoUpdate(txs[i]);
  }
  $(this).trigger('update');
};

TransactionDatabase.prototype.getTransactions = function () {
  return this.txs;
};

TransactionDatabase.prototype.clear = function () {
  this.txs = [];
  this.txIndex = {};
  $(this).trigger('update');
};
