var assert = require('assert');
var BigInteger = require('../').BigInteger;
var bytesToHex = require('../').convert.bytesToHex;

test('toByteArraySigned', function() {
    function hex(num) {
        var bytes = BigInteger.valueOf(num).toByteArraySigned();
        var hex = bytesToHex(bytes);
        return '0x' + hex;
    }

    assert.equal(hex( 0), '0x');
    assert.equal(hex( 1), '0x01');
    assert.equal(hex(-1), '0x81');
    assert.equal(hex( 127), '0x7f');
    assert.equal(hex(-127), '0xff');
    assert.equal(hex( 255), '0x00ff');
    assert.equal(hex(-255), '0x80ff');
    assert.equal(hex( 16300),  '0x3fac');
    assert.equal(hex(-16300), '0xbfac');
    assert.equal(hex( 62300), '0x00f35c');
    assert.equal(hex(-62300), '0x80f35c');
});

