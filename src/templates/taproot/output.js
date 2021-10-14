'use strict';
// OP_1 {scriptHash}
Object.defineProperty(exports, '__esModule', { value: true });
exports.check = void 0;
const bscript = require('../../script');
const script_1 = require('../../script');
function check(script) {
  const buffer = bscript.compile(script);
  return (
    buffer.length === 34 &&
    buffer[0] === script_1.OPS.OP_1 &&
    buffer[1] === 0x20
  );
}
exports.check = check;
check.toJSON = () => {
  return 'Taproot output';
};
