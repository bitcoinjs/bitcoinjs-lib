'use strict';
// OP_0 [signatures ...]
Object.defineProperty(exports, '__esModule', { value: true });
const bscript = require('../../script');
const script_1 = require('../../script');
function partialSignature(value) {
  return (
    value === script_1.OPS.OP_0 || bscript.isCanonicalScriptSignature(value)
  );
}
function check(script, allowIncomplete) {
  const chunks = bscript.decompile(script);
  if (chunks.length < 2) return false;
  if (chunks[0] !== script_1.OPS.OP_0) return false;
  if (allowIncomplete) {
    return chunks.slice(1).every(partialSignature);
  }
  return chunks.slice(1).every(bscript.isCanonicalScriptSignature);
}
exports.check = check;
check.toJSON = () => {
  return 'multisig input';
};
