'use strict';
// m [pubKeys ...] n OP_CHECKMULTISIG
Object.defineProperty(exports, '__esModule', { value: true });
const bscript = require('../../script');
const script_1 = require('../../script');
const types = require('../../types');
const OP_INT_BASE = script_1.OPS.OP_RESERVED; // OP_1 - 1
function check(script, allowIncomplete) {
  const chunks = bscript.decompile(script);
  if (chunks.length < 4) return false;
  if (chunks[chunks.length - 1] !== script_1.OPS.OP_CHECKMULTISIG) return false;
  if (!types.Number(chunks[0])) return false;
  if (!types.Number(chunks[chunks.length - 2])) return false;
  const m = chunks[0] - OP_INT_BASE;
  const n = chunks[chunks.length - 2] - OP_INT_BASE;
  if (m <= 0) return false;
  if (n > 16) return false;
  if (m > n) return false;
  if (n !== chunks.length - 3) return false;
  if (allowIncomplete) return true;
  const keys = chunks.slice(1, -2);
  return keys.every(bscript.isCanonicalPubKey);
}
exports.check = check;
check.toJSON = () => {
  return 'multi-sig output';
};
