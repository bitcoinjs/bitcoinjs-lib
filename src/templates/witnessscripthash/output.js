'use strict';
// OP_0 {scriptHash}
Object.defineProperty(exports, '__esModule', { value: true });
const bscript = require('../../script');
const script_1 = require('../../script');
function check(script) {
  const buffer = bscript.compile(script);
  return (
    buffer.length === 34 &&
    buffer[0] === script_1.OPS.OP_0 &&
    buffer[1] === 0x20
  );
}
exports.check = check;
check.toJSON = () => {
  return 'Witness scriptHash output';
};
