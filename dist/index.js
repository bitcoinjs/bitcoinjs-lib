var bitcoin = require('../')

var exports = {
  BigInteger: require('bigi'),
  ecurve: require('ecurve')
}

for (var key in bitcoin) {
  exports[key] = bitcoin[key]
}

module.exports = exports
