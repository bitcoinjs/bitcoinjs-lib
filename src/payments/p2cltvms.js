'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const bscript = require('../script');
const scriptNumber = require('../script_number');
const lazy = require('./lazy');
const p2ms_1 = require('./p2ms');
const OPS = bscript.OPS;
const typef = require('typeforce');
// input: OP_0 [signatures ...]
// output: locktime OP_CHECKLOCKTIMEVERIFY OP_DROP m [pubKeys ...] n OP_CHECKMULTISIG
function p2cltvms(a, opts) {
  const innerPayment = Object.assign({}, a);
  let fallbackLocktime = a.locktime || 0;
  if (a.output) {
    const chunks = bscript.decompile(a.output);
    if (chunks[1] !== OPS.OP_CHECKLOCKTIMEVERIFY || chunks[2] !== OPS.OP_DROP) {
      throw new TypeError('Output is not p2cltvms' + `(${chunks})`);
    }
    if (!typef.Buffer(chunks[0])) {
      throw new TypeError('Invalid CLTV parameter');
    }
    fallbackLocktime = scriptNumber.decode(chunks[0]);
    const p2msOutput = chunks.slice(3);
    innerPayment.output = bscript.compile(p2msOutput);
  }
  const o = p2ms_1.p2ms(innerPayment, opts);
  o.m, o.n, o.pubkey; // force lazy decoding
  o.locktime = a.locktime || fallbackLocktime;
  if (o.output) {
    const chunks = bscript.decompile(o.output);
    chunks.splice(
      0,
      0,
      scriptNumber.encode(o.locktime),
      OPS.OP_CHECKLOCKTIMEVERIFY,
      OPS.OP_DROP,
    );
    o.output = bscript.compile(chunks);
  }
  lazy.prop(o, 'name', () => {
    if (!o.m || !o.n) return;
    return `p2cltvms(${o.locktime}, ${o.m} of ${o.n})`;
  });
  return Object.assign({}, o, a);
}
exports.p2cltvms = p2cltvms;
