var assert = require('assert')
var base58 = require('../../').base58
var base58check = require('../../').base58check
var crypto = require('../../').crypto
var fs = require('fs')
var request = require('request')
var secureRandom = require('secure-random')

function b2h(b) { return new Buffer(b).toString('hex') }
function h2b(h) { return new Buffer(h, 'hex') }
function randomBuf(s) {
  return new Buffer(secureRandom(s))
}

request('https://raw.githubusercontent.com/bitcoin/bitcoin/master/src/test/data/base58_encode_decode.json', function (error, response, body) {
  assert.ifError(error)
  assert.equal(response.statusCode, 200)

  var data = JSON.parse(body)
  var valid = data.map(function(x) {
    return {
      hex: x[0],
      string: x[1]
    }
  })

  // https://github.com/bitcoin/bitcoin/blob/master/src/test/base58_tests.cpp#L73
  //  FIXME: Doesn't work TODO
  //  valid.push({
  //    hex: '971a55',
  //    string: ' \t\n\v\f\r skip \r\f\v\n\t '
  //  })

  var fixtureJSON = JSON.stringify({
    valid: valid,
    invalid: [
      {
      description: 'non-base58 string',
      string: 'invalid'
    },
    {
      description: 'non-base58 alphabet',
      string: 'c2F0b3NoaQo='
    },
    {
      description: 'leading whitespace',
      string: ' 1111111111'
    },
    {
      description: 'trailing whitespace',
      string: '1111111111 '
    },
    // https://github.com/bitcoin/bitcoin/blob/master/src/test/base58_tests.cpp#L72
    {
      description: 'unexpected character after whitespace',
      string: ' \t\n\v\f\r skip \r\f\v\n\t a'
    }
    ]
  }, null, '  ')

  fs.writeFileSync('./test/fixtures/base58.js', 'module.exports = ' + fixtureJSON)
})

request('https://raw.githubusercontent.com/bitcoin/bitcoin/master/src/test/data/base58_keys_valid.json', function (error, response, body) {
  request('https://raw.githubusercontent.com/bitcoin/bitcoin/master/src/test/data/base58_keys_invalid.json', function (error2, response2, body2) {
    assert.ifError(error)
    assert.ifError(error2)
    assert.equal(response.statusCode, 200)
    assert.equal(response2.statusCode, 200)

    var validData = JSON.parse(body)
    var invalidData = JSON.parse(body2)

    var valid = validData.map(function(x) {
      var string = x[0]
      var hex = x[1]
      var params = x[2]

      if (params.isCompressed) {
        hex += '01'
      }
      assert.equal(b2h(base58check.decode(string).payload), hex)

      return {
        string: string,
        decode: {
          version: base58check.decode(string).version,
          payload: hex,
          checksum: b2h(base58check.decode(string).checksum),
        }
      }
    })
    var invalid2 = invalidData.map(function(x) { return x[0] })

    // Our own tests
    var hash = crypto.hash160(randomBuf(65))
    var checksum = base58check.decode(base58check.encode(hash)).checksum

    var fixtureJSON = JSON.stringify({
      valid: valid,
      invalid: [
        {
        base58check: base58check.encode(hash.slice(0, 18), 0x05),
        description: 'hash too short'
      },
      {
        base58check: base58check.encode(Buffer.concat([hash, randomBuf(2)]), 0x05),
        description: 'hash too long'
      },
      {
        base58check: base58.encode(Buffer.concat([new Buffer([0x01]), hash, checksum])),
        description: 'bad version byte',
      },
      {
        base58check: base58.encode(Buffer.concat([new Buffer([0x05]), randomBuf(20), checksum])),
        description: 'bad payload',
      },
      {
        base58check: base58.encode(Buffer.concat([new Buffer([0x05]), hash, randomBuf(4)])),
        description: 'bad SHA256 checksum',
      }
      ],
      invalid2: invalid2
    }, null, '  ')

    fs.writeFileSync('./test/fixtures/base58check.js', 'module.exports = ' + fixtureJSON)
  })
})
