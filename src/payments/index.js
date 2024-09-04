'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.isP2TR =
  exports.isP2SHScript =
  exports.isP2WSHScript =
  exports.isP2WPKH =
  exports.isP2PKH =
  exports.isP2PK =
  exports.isP2MS =
  exports.p2tr =
  exports.p2wsh =
  exports.p2wpkh =
  exports.p2sh =
  exports.p2pkh =
  exports.p2pk =
  exports.p2ms =
  exports.embed =
    void 0;
const embed_1 = require('./embed');
Object.defineProperty(exports, 'embed', {
  enumerable: true,
  get: function () {
    return embed_1.p2data;
  },
});
const p2ms_1 = require('./p2ms');
Object.defineProperty(exports, 'p2ms', {
  enumerable: true,
  get: function () {
    return p2ms_1.p2ms;
  },
});
const p2pk_1 = require('./p2pk');
Object.defineProperty(exports, 'p2pk', {
  enumerable: true,
  get: function () {
    return p2pk_1.p2pk;
  },
});
const p2pkh_1 = require('./p2pkh');
Object.defineProperty(exports, 'p2pkh', {
  enumerable: true,
  get: function () {
    return p2pkh_1.p2pkh;
  },
});
const p2sh_1 = require('./p2sh');
Object.defineProperty(exports, 'p2sh', {
  enumerable: true,
  get: function () {
    return p2sh_1.p2sh;
  },
});
const p2wpkh_1 = require('./p2wpkh');
Object.defineProperty(exports, 'p2wpkh', {
  enumerable: true,
  get: function () {
    return p2wpkh_1.p2wpkh;
  },
});
const p2wsh_1 = require('./p2wsh');
Object.defineProperty(exports, 'p2wsh', {
  enumerable: true,
  get: function () {
    return p2wsh_1.p2wsh;
  },
});
const p2tr_1 = require('./p2tr');
Object.defineProperty(exports, 'p2tr', {
  enumerable: true,
  get: function () {
    return p2tr_1.p2tr;
  },
});
/**
 * Checks if a given payment factory can generate a payment script from a given script.
 * @param payment The payment factory to check.
 * @returns A function that takes a script and returns a boolean indicating whether the payment factory can generate a payment script from the script.
 */
function isPaymentFactory(payment) {
  return script => {
    try {
      payment({ output: script });
      return true;
    } catch (err) {
      return false;
    }
  };
}
exports.isP2MS = isPaymentFactory(p2ms_1.p2ms);
exports.isP2PK = isPaymentFactory(p2pk_1.p2pk);
exports.isP2PKH = isPaymentFactory(p2pkh_1.p2pkh);
exports.isP2WPKH = isPaymentFactory(p2wpkh_1.p2wpkh);
exports.isP2WSHScript = isPaymentFactory(p2wsh_1.p2wsh);
exports.isP2SHScript = isPaymentFactory(p2sh_1.p2sh);
exports.isP2TR = isPaymentFactory(p2tr_1.p2tr);
