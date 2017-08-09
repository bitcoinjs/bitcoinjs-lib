var Blockchain = require('cb-http-client')
var BLOCKTRAIL_API_KEY = process.env.BLOCKTRAIL_API_KEY || 'c0bd8155c66e3fb148bb1664adc1e4dacd872548'
module.exports = new Blockchain('https://api.blocktrail.com/cb/v0.2.1/BTC', { api_key: BLOCKTRAIL_API_KEY })
