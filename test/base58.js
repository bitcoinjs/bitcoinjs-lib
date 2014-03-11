/* global describe, it */
var assert = require('assert');
var base58 = require('../').base58;
var convert = require('../').convert;

describe('base58', function() {
    describe('decode', function() {
        it('validates known examples', function() {
            var enc = '5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ';
            var hex = '800c28fca386c7a227600b2fe50b7cae11ec86d3bf1fbe471be89827e19d72aa1d507a5b8d';
            assert.deepEqual(base58.decode(enc), convert.hexToBytes(hex));
        })
    })

    describe('encode', function() {
        it('handles known examples', function() {
            var enc = '5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ';
            var hex = '800c28fca386c7a227600b2fe50b7cae11ec86d3bf1fbe471be89827e19d72aa1d507a5b8d';
            assert.equal(base58.encode(convert.hexToBytes(hex)), enc);
        })
    })

    describe('checkEncode', function() {
        it('handles known examples', function() {
          var input = [
            171, 210, 178, 125, 2, 16, 86, 184, 248, 88, 235,
            163, 244, 160, 83, 156, 184, 186, 45, 167, 169, 164,
            67, 125, 163, 89, 106, 243, 207, 193, 149, 206
          ]
          var vbyte = 239

          assert.equal(base58.checkEncode(input, vbyte),
                       '92tb9mjz6q9eKZjYvLsgk87kPrMoh7BGRumSzPeUGhmigtsfrbP');
        })
    })

    describe('checkDecode', function() {
        it('handles known examples', function() {
          var input = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'
          var expected =  [
            98, 233, 7, 177, 92, 191, 39, 213, 66, 83,
            153, 235, 246, 240, 251, 80, 235, 184, 143, 24
          ];
          expected.version = 0

          assert.deepEqual(base58.checkDecode(input), expected);
        })
    })
})
