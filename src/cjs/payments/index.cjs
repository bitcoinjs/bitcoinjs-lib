'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.p2tr =
  exports.p2wsh =
  exports.p2wpkh =
  exports.p2sh =
  exports.p2pkh =
  exports.p2pk =
  exports.p2ms =
  exports.embed =
    void 0;
const embed_js_1 = require('./embed.cjs');
Object.defineProperty(exports, 'embed', {
  enumerable: true,
  get: function () {
    return embed_js_1.p2data;
  },
});
const p2ms_js_1 = require('./p2ms.cjs');
Object.defineProperty(exports, 'p2ms', {
  enumerable: true,
  get: function () {
    return p2ms_js_1.p2ms;
  },
});
const p2pk_js_1 = require('./p2pk.cjs');
Object.defineProperty(exports, 'p2pk', {
  enumerable: true,
  get: function () {
    return p2pk_js_1.p2pk;
  },
});
const p2pkh_js_1 = require('./p2pkh.cjs');
Object.defineProperty(exports, 'p2pkh', {
  enumerable: true,
  get: function () {
    return p2pkh_js_1.p2pkh;
  },
});
const p2sh_js_1 = require('./p2sh.cjs');
Object.defineProperty(exports, 'p2sh', {
  enumerable: true,
  get: function () {
    return p2sh_js_1.p2sh;
  },
});
const p2wpkh_js_1 = require('./p2wpkh.cjs');
Object.defineProperty(exports, 'p2wpkh', {
  enumerable: true,
  get: function () {
    return p2wpkh_js_1.p2wpkh;
  },
});
const p2wsh_js_1 = require('./p2wsh.cjs');
Object.defineProperty(exports, 'p2wsh', {
  enumerable: true,
  get: function () {
    return p2wsh_js_1.p2wsh;
  },
});
const p2tr_js_1 = require('./p2tr.cjs');
Object.defineProperty(exports, 'p2tr', {
  enumerable: true,
  get: function () {
    return p2tr_js_1.p2tr;
  },
});
// TODO
// witness commitment
