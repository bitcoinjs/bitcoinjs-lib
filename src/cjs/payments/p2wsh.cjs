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
exports.p2wsh = p2wsh;
const sha256_1 = require('@noble/hashes/sha256');
const networks_js_1 = require('../networks.cjs');
const bscript = __importStar(require('../script.cjs'));
const types_js_1 = require('../types.cjs');
const lazy = __importStar(require('./lazy.cjs'));
const bech32_1 = require('bech32');
const tools = __importStar(require('uint8array-tools'));
const v = __importStar(require('valibot'));
const OPS = bscript.OPS;
const EMPTY_BUFFER = new Uint8Array(0);
function chunkHasUncompressedPubkey(chunk) {
  if (
    chunk instanceof Uint8Array &&
    chunk.length === 65 &&
    chunk[0] === 0x04 &&
    (0, types_js_1.isPoint)(chunk)
  ) {
    return true;
  } else {
    return false;
  }
}
// input: <>
// witness: [redeemScriptSig ...] {redeemScript}
// output: OP_0 {sha256(redeemScript)}
/**
 * Creates a Pay-to-Witness-Script-Hash (P2WSH) payment object.
 *
 * @param a - The payment object containing the necessary data.
 * @param opts - Optional payment options.
 * @returns The P2WSH payment object.
 * @throws {TypeError} If the required data is missing or invalid.
 */
function p2wsh(a, opts) {
  if (!a.address && !a.hash && !a.output && !a.redeem && !a.witness)
    throw new TypeError('Not enough data');
  opts = Object.assign({ validate: true }, opts || {});
  v.parse(
    (0, types_js_1.NullablePartial)({
      network: v.object({}),
      address: v.string(),
      hash: types_js_1.Buffer256bitSchema,
      output: (0, types_js_1.NBufferSchemaFactory)(34),
      redeem: (0, types_js_1.NullablePartial)({
        input: types_js_1.BufferSchema,
        network: v.object({}),
        output: types_js_1.BufferSchema,
        witness: v.array(types_js_1.BufferSchema),
      }),
      input: (0, types_js_1.NBufferSchemaFactory)(0),
      witness: v.array(types_js_1.BufferSchema),
    }),
    a,
  );
  const _address = lazy.value(() => {
    const result = bech32_1.bech32.decode(a.address);
    const version = result.words.shift();
    const data = bech32_1.bech32.fromWords(result.words);
    return {
      version,
      prefix: result.prefix,
      data: Uint8Array.from(data),
    };
  });
  const _rchunks = lazy.value(() => {
    return bscript.decompile(a.redeem.input);
  });
  let network = a.network;
  if (!network) {
    network = (a.redeem && a.redeem.network) || networks_js_1.bitcoin;
  }
  const o = { network };
  lazy.prop(o, 'address', () => {
    if (!o.hash) return;
    const words = bech32_1.bech32.toWords(o.hash);
    words.unshift(0x00);
    return bech32_1.bech32.encode(network.bech32, words);
  });
  lazy.prop(o, 'hash', () => {
    if (a.output) return a.output.slice(2);
    if (a.address) return _address().data;
    if (o.redeem && o.redeem.output)
      return (0, sha256_1.sha256)(o.redeem.output);
  });
  lazy.prop(o, 'output', () => {
    if (!o.hash) return;
    return bscript.compile([OPS.OP_0, o.hash]);
  });
  lazy.prop(o, 'redeem', () => {
    if (!a.witness) return;
    return {
      output: a.witness[a.witness.length - 1],
      input: EMPTY_BUFFER,
      witness: a.witness.slice(0, -1),
    };
  });
  lazy.prop(o, 'input', () => {
    if (!o.witness) return;
    return EMPTY_BUFFER;
  });
  lazy.prop(o, 'witness', () => {
    // transform redeem input to witness stack?
    if (
      a.redeem &&
      a.redeem.input &&
      a.redeem.input.length > 0 &&
      a.redeem.output &&
      a.redeem.output.length > 0
    ) {
      const stack = bscript.toStack(_rchunks());
      // assign, and blank the existing input
      o.redeem = Object.assign({ witness: stack }, a.redeem);
      o.redeem.input = EMPTY_BUFFER;
      return [].concat(stack, a.redeem.output);
    }
    if (!a.redeem) return;
    if (!a.redeem.output) return;
    if (!a.redeem.witness) return;
    return [].concat(a.redeem.witness, a.redeem.output);
  });
  lazy.prop(o, 'name', () => {
    const nameParts = ['p2wsh'];
    if (o.redeem !== undefined && o.redeem.name !== undefined)
      nameParts.push(o.redeem.name);
    return nameParts.join('-');
  });
  // extended validation
  if (opts.validate) {
    let hash = Uint8Array.from([]);
    if (a.address) {
      if (_address().prefix !== network.bech32)
        throw new TypeError('Invalid prefix or Network mismatch');
      if (_address().version !== 0x00)
        throw new TypeError('Invalid address version');
      if (_address().data.length !== 32)
        throw new TypeError('Invalid address data');
      hash = _address().data;
    }
    if (a.hash) {
      if (hash.length > 0 && tools.compare(hash, a.hash) !== 0)
        throw new TypeError('Hash mismatch');
      else hash = a.hash;
    }
    if (a.output) {
      if (
        a.output.length !== 34 ||
        a.output[0] !== OPS.OP_0 ||
        a.output[1] !== 0x20
      )
        throw new TypeError('Output is invalid');
      const hash2 = a.output.slice(2);
      if (hash.length > 0 && tools.compare(hash, hash2) !== 0)
        throw new TypeError('Hash mismatch');
      else hash = hash2;
    }
    if (a.redeem) {
      if (a.redeem.network && a.redeem.network !== network)
        throw new TypeError('Network mismatch');
      // is there two redeem sources?
      if (
        a.redeem.input &&
        a.redeem.input.length > 0 &&
        a.redeem.witness &&
        a.redeem.witness.length > 0
      )
        throw new TypeError('Ambiguous witness source');
      // is the redeem output non-empty/valid?
      if (a.redeem.output) {
        const decompile = bscript.decompile(a.redeem.output);
        if (!decompile || decompile.length < 1)
          throw new TypeError('Redeem.output is invalid');
        if (a.redeem.output.byteLength > 3600)
          throw new TypeError(
            'Redeem.output unspendable if larger than 3600 bytes',
          );
        if (bscript.countNonPushOnlyOPs(decompile) > 201)
          throw new TypeError(
            'Redeem.output unspendable with more than 201 non-push ops',
          );
        // match hash against other sources
        const hash2 = (0, sha256_1.sha256)(a.redeem.output);
        if (hash.length > 0 && tools.compare(hash, hash2) !== 0)
          throw new TypeError('Hash mismatch');
        else hash = hash2;
      }
      if (a.redeem.input && !bscript.isPushOnly(_rchunks()))
        throw new TypeError('Non push-only scriptSig');
      if (
        a.witness &&
        a.redeem.witness &&
        !(0, types_js_1.stacksEqual)(a.witness, a.redeem.witness)
      )
        throw new TypeError('Witness and redeem.witness mismatch');
      if (
        (a.redeem.input && _rchunks().some(chunkHasUncompressedPubkey)) ||
        (a.redeem.output &&
          (bscript.decompile(a.redeem.output) || []).some(
            chunkHasUncompressedPubkey,
          ))
      ) {
        throw new TypeError(
          'redeem.input or redeem.output contains uncompressed pubkey',
        );
      }
    }
    if (a.witness && a.witness.length > 0) {
      const wScript = a.witness[a.witness.length - 1];
      if (
        a.redeem &&
        a.redeem.output &&
        tools.compare(a.redeem.output, wScript) !== 0
      )
        throw new TypeError('Witness and redeem.output mismatch');
      if (
        a.witness.some(chunkHasUncompressedPubkey) ||
        (bscript.decompile(wScript) || []).some(chunkHasUncompressedPubkey)
      )
        throw new TypeError('Witness contains uncompressed pubkey');
    }
  }
  return Object.assign(o, a);
}
