var bitcoin = require('./src/index')

var exports = {
  BigInteger: require('bigi'),
  ecurve: require('ecurve'),
  secureRandom: require('secure-random')
}

for (var key in bitcoin) {
  exports[key] = bitcoin[key]
}

module.exports = exports
