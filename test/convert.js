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
})
