'use strict';
// {signature}
// TODO: define p2tr script path input template
Object.defineProperty(exports, '__esModule', { value: true });
exports.check = void 0;
const bscript = require('../../script');
function check(chunks) {
  return chunks.length === 1 && bscript.isCanonicalSchnorrSignature(chunks[0]);
}
exports.check = check;
check.toJSON = () => {
  return 'taproot input';
};
