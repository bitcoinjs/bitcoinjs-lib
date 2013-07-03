var assert = require('assert');
var conv = require('../').convert;

var bytesToHex = conv.bytesToHex;
var hexToBytes = conv.hexToBytes;

test('bytesToHex', function() {
    assert.equal(bytesToHex([0, 1, 2, 255]), '000102ff');
});

test('hexToBytes', function() {
    assert.deepEqual(hexToBytes('000102ff'), [0, 1, 2, 255]);
});

test('bytesToHex - hexToBytes', function() {
    var bytes = [];
    for (var i=0 ; i<256 ; ++i) {
        bytes.push(i);
    }

    var hex = bytesToHex(bytes);
    assert.equal(hex.length, 512);
    assert.deepEqual(hexToBytes(hex), bytes);
});
