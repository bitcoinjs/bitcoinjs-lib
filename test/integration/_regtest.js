const { RegtestUtils } = require('regtest-client')

const bitcoin = require('../..')
const APIPASS = process.env.APIPASS || 'satoshi'
const APIURL = process.env.APIURL || 'https://regtest.bitbank.cc/1'

const regtestUtils = new RegtestUtils(bitcoin, { APIPASS, APIURL })

module.exports = regtestUtils;
