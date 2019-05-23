'use strict';
// OP_0 {pubKeyHash}
Object.defineProperty(exports, '__esModule', { value: true });
const bscript = require('../../script');
const script_1 = require('../../script');
function check(script) {
  const buffer = bscript.compile(script);
  return (
    buffer.length === 22 &&
    buffer[0] === script_1.OPS.OP_0 &&
    buffer[1] === 0x14
  );
}
exports.check = check;
check.toJSON = () => {
  return 'Witness pubKeyHash output';
};
