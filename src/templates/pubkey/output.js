'use strict';
// {pubKey} OP_CHECKSIG
Object.defineProperty(exports, '__esModule', { value: true });
const bscript = require('../../script');
const script_1 = require('../../script');
function check(script) {
  const chunks = bscript.decompile(script);
  return (
    chunks.length === 2 &&
    bscript.isCanonicalPubKey(chunks[0]) &&
    chunks[1] === script_1.OPS.OP_CHECKSIG
  );
}
exports.check = check;
check.toJSON = () => {
  return 'pubKey output';
};
