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
exports.p2pk = p2pk;
const networks_js_1 = require('../networks.cjs');
const bscript = __importStar(require('../script.cjs'));
const types_js_1 = require('../types.cjs');
const lazy = __importStar(require('./lazy.cjs'));
const tools = __importStar(require('uint8array-tools'));
const v = __importStar(require('valibot'));
const OPS = bscript.OPS;
// input: {signature}
// output: {pubKey} OP_CHECKSIG
/**
 * Creates a pay-to-public-key (P2PK) payment object.
 *
 * @param a - The payment object containing the necessary data.
 * @param opts - Optional payment options.
 * @returns The P2PK payment object.
 * @throws {TypeError} If the required data is not provided or if the data is invalid.
 */
function p2pk(a, opts) {
  if (!a.input && !a.output && !a.pubkey && !a.input && !a.signature)
    throw new TypeError('Not enough data');
  opts = Object.assign({ validate: true }, opts || {});
  v.parse(
    v.partial(
      v.object({
        network: v.object({}),
        output: types_js_1.BufferSchema,
        pubkey: v.custom(types_js_1.isPoint, 'invalid pubkey'),
        signature: v.custom(
          bscript.isCanonicalScriptSignature,
          'Expected signature to be of type isCanonicalScriptSignature',
        ),
        input: types_js_1.BufferSchema,
      }),
    ),
    a,
  );
  const _chunks = lazy.value(() => {
    return bscript.decompile(a.input);
  });
  const network = a.network || networks_js_1.bitcoin;
  const o = { name: 'p2pk', network };
  lazy.prop(o, 'output', () => {
    if (!a.pubkey) return;
    return bscript.compile([a.pubkey, OPS.OP_CHECKSIG]);
  });
  lazy.prop(o, 'pubkey', () => {
    if (!a.output) return;
    return a.output.slice(1, -1);
  });
  lazy.prop(o, 'signature', () => {
    if (!a.input) return;
    return _chunks()[0];
  });
  lazy.prop(o, 'input', () => {
    if (!a.signature) return;
    return bscript.compile([a.signature]);
  });
  lazy.prop(o, 'witness', () => {
    if (!o.input) return;
    return [];
  });
  // extended validation
  if (opts.validate) {
    if (a.output) {
      if (a.output[a.output.length - 1] !== OPS.OP_CHECKSIG)
        throw new TypeError('Output is invalid');
      if (!(0, types_js_1.isPoint)(o.pubkey))
        throw new TypeError('Output pubkey is invalid');
      if (a.pubkey && tools.compare(a.pubkey, o.pubkey) !== 0)
        throw new TypeError('Pubkey mismatch');
    }
    if (a.signature) {
      if (a.input && tools.compare(a.input, o.input) !== 0)
        throw new TypeError('Signature mismatch');
    }
    if (a.input) {
      if (_chunks().length !== 1) throw new TypeError('Input is invalid');
      if (!bscript.isCanonicalScriptSignature(o.signature))
        throw new TypeError('Input has invalid signature');
    }
  }
  return Object.assign(o, a);
}
