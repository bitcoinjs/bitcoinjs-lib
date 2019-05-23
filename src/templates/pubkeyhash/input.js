'use strict';
// {signature} {pubKey}
Object.defineProperty(exports, '__esModule', { value: true });
const bscript = require('../../script');
function check(script) {
  const chunks = bscript.decompile(script);
  return (
    chunks.length === 2 &&
    bscript.isCanonicalScriptSignature(chunks[0]) &&
    bscript.isCanonicalPubKey(chunks[1])
  );
}
exports.check = check;
check.toJSON = () => {
  return 'pubKeyHash input';
};
