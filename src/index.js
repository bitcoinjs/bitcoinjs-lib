const script = require('./script')
const templates = require('./templates')
for (let key in templates) {
  script[key] = templates[key]
}

module.exports = {
  Block: require('./block'),
  ECPair: require('./ecpair'),
  Transaction: require('./transaction'),
  TransactionBuilder: require('./transaction_builder'),

  address: require('./address'),
  bip32: require('bip32'),
  crypto: require('./crypto'),
  networks: require('./networks'),
  opcodes: require('bitcoin-ops'),
  payments: require('./payments'),
  script: script
}
