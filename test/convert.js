/* global describe, it */
var assert = require('assert');
var convert = require('../src/convert.js');

describe('convert', function() {
    describe('bytesToHex', function() {
        it('handles example 1', function() {
            assert.equal(convert.bytesToHex([0, 1, 2, 255]), '000102ff');
        })
    })

    describe('hexToBytes', function() {
        it('handles example 1', function() {
            assert.deepEqual(convert.hexToBytes('000102ff'), [0, 1, 2, 255]);
        })
    })

    it('converts from bytes to hex and back', function() {
        var bytes = [];
        for (var i=0 ; i<256 ; ++i) {
            bytes.push(i);
        }

        var hex = convert.bytesToHex(bytes);
        assert.equal(hex.length, 512);
        assert.deepEqual(convert.hexToBytes(hex), bytes);
    })

    describe('bytesToBase64', function() {
        it('passes RFC4648 test vectors', function() {
            // Test vectors from:
            // http://tools.ietf.org/html/rfc4648#page-12

            var b64 = function(s) {
                return convert.bytesToBase64(convert.stringToBytes(s))
            }

            assert.equal(b64(''), '')
            assert.equal(b64('f'), 'Zg==')
            assert.equal(b64('fo'), 'Zm8=')
            assert.equal(b64('foo'), 'Zm9v')
            assert.equal(b64('foob'), 'Zm9vYg==')
            assert.equal(b64('fooba'), 'Zm9vYmE=')
            assert.equal(b64('foobar'), 'Zm9vYmFy')
        })
    })
    
    describe('coerceToBytes', function() {
        it('works with bytes or hex string', function() {
            assert.deepEqual(convert.coerceToBytes('ABCD'), [171, 205])
            assert.deepEqual(convert.coerceToBytes([171, 205]), [171, 205])
        })
    })
})
