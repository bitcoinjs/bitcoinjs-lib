const { RegtestUtils } = require('regtest-client')

const APIPASS = process.env.APIPASS || 'satoshi'
const APIURL = process.env.APIURL || 'https://regtest.bitbank.cc/1'

const regtestUtils = new RegtestUtils({ APIPASS, APIURL })

module.exports = regtestUtils;
