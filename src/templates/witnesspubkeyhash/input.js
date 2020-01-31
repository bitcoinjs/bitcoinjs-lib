'use strict';
// {signature} {pubKey}
Object.defineProperty(exports, '__esModule', { value: true });
const bscript = require('../../script');
function isCompressedCanonicalPubKey(pubKey) {
  return bscript.isCanonicalPubKey(pubKey) && pubKey.length === 33;
}
function check(script) {
  const chunks = bscript.decompile(script);
  return (
    chunks.length === 2 &&
    bscript.isCanonicalScriptSignature(chunks[0]) &&
    isCompressedCanonicalPubKey(chunks[1])
  );
}
exports.check = check;
check.toJSON = () => {
  return 'witnessPubKeyHash input';
};
