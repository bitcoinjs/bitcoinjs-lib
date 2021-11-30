'use strict';
// OP_HASH160 {scriptHash} OP_EQUAL
Object.defineProperty(exports, '__esModule', { value: true });
const bscript = require('../../script');
const script_1 = require('../../script');
function check(script) {
  const buffer = bscript.compile(script);
  return (
    buffer.length === 23 &&
    buffer[0] === script_1.OPS.OP_HASH160 &&
    buffer[1] === 0x14 &&
    buffer[22] === script_1.OPS.OP_EQUAL
  );
}
exports.check = check;
check.toJSON = () => {
  return 'scriptHash output';
};
