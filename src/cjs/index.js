'use strict';
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null)
      for (var k in mod)
        if (k !== 'default' && Object.prototype.hasOwnProperty.call(mod, k))
          __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.initEccLib =
  exports.Transaction =
  exports.opcodes =
  exports.Psbt =
  exports.Block =
  exports.script =
  exports.payments =
  exports.networks =
  exports.crypto =
  exports.address =
    void 0;
const address = __importStar(require('./address'));
exports.address = address;
const crypto = __importStar(require('./crypto'));
exports.crypto = crypto;
const networks = __importStar(require('./networks'));
exports.networks = networks;
const payments = __importStar(require('./payments'));
exports.payments = payments;
const script = __importStar(require('./script'));
exports.script = script;
var block_1 = require('./block');
Object.defineProperty(exports, 'Block', {
  enumerable: true,
  get: function () {
    return block_1.Block;
  },
});
var psbt_1 = require('./psbt');
Object.defineProperty(exports, 'Psbt', {
  enumerable: true,
  get: function () {
    return psbt_1.Psbt;
  },
});
/** @hidden */
var ops_1 = require('./ops');
Object.defineProperty(exports, 'opcodes', {
  enumerable: true,
  get: function () {
    return ops_1.OPS;
  },
});
var transaction_1 = require('./transaction');
Object.defineProperty(exports, 'Transaction', {
  enumerable: true,
  get: function () {
    return transaction_1.Transaction;
  },
});
var ecc_lib_1 = require('./ecc_lib');
Object.defineProperty(exports, 'initEccLib', {
  enumerable: true,
  get: function () {
    return ecc_lib_1.initEccLib;
  },
});
