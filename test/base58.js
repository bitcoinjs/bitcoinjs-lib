/* global describe, it */
var assert = require('assert');
var base58 = require('../').base58;
var conv = require('../').convert;

describe('base58', function() {
    describe('decode', function() {
        it('validates known examples', function() {
            var enc = '5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ';
            var hex = '800c28fca386c7a227600b2fe50b7cae11ec86d3bf1fbe471be89827e19d72aa1d507a5b8d';
            assert.deepEqual(base58.decode(enc), conv.hexToBytes(hex));
        })
    })

    describe('encode', function() {
        it('handles known examples', function() {
            var enc = '5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ';
            var hex = '800c28fca386c7a227600b2fe50b7cae11ec86d3bf1fbe471be89827e19d72aa1d507a5b8d';
            assert.equal(base58.encode(conv.hexToBytes(hex)), enc);
        })
    })
})
