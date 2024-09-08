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
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.p2sh = p2sh;
const bcrypto = __importStar(require('../crypto.cjs'));
const networks_js_1 = require('../networks.cjs');
const bscript = __importStar(require('../script.cjs'));
const types_js_1 = require('../types.cjs');
const lazy = __importStar(require('./lazy.cjs'));
const bs58check_1 = __importDefault(require('bs58check'));
const tools = __importStar(require('uint8array-tools'));
const v = __importStar(require('valibot'));
const OPS = bscript.OPS;
// input: [redeemScriptSig ...] {redeemScript}
// witness: <?>
// output: OP_HASH160 {hash160(redeemScript)} OP_EQUAL
/**
 * Creates a Pay-to-Script-Hash (P2SH) payment object.
 *
 * @param a - The payment object containing the necessary data.
 * @param opts - Optional payment options.
 * @returns The P2SH payment object.
 * @throws {TypeError} If the required data is not provided or if the data is invalid.
 */
function p2sh(a, opts) {
  if (!a.address && !a.hash && !a.output && !a.redeem && !a.input)
    throw new TypeError('Not enough data');
  opts = Object.assign({ validate: true }, opts || {});
  v.parse(
    v.partial(
      v.object({
        network: v.object({}),
        address: v.string(),
        hash: (0, types_js_1.NBufferSchemaFactory)(20),
        output: (0, types_js_1.NBufferSchemaFactory)(23),
        redeem: v.partial(
          v.object({
            network: v.object({}),
            output: types_js_1.BufferSchema,
            input: types_js_1.BufferSchema,
            witness: v.array(types_js_1.BufferSchema),
          }),
        ),
        input: types_js_1.BufferSchema,
        witness: v.array(types_js_1.BufferSchema),
      }),
    ),
    a,
  );
  let network = a.network;
  if (!network) {
    network = (a.redeem && a.redeem.network) || networks_js_1.bitcoin;
  }
  const o = { network };
  const _address = lazy.value(() => {
    const payload = bs58check_1.default.decode(a.address);
    const version = tools.readUInt8(payload, 0);
    const hash = payload.slice(1);
    return { version, hash };
  });
  const _chunks = lazy.value(() => {
    return bscript.decompile(a.input);
  });
  const _redeem = lazy.value(() => {
    const chunks = _chunks();
    const lastChunk = chunks[chunks.length - 1];
    return {
      network,
      output: lastChunk === OPS.OP_FALSE ? Uint8Array.from([]) : lastChunk,
      input: bscript.compile(chunks.slice(0, -1)),
      witness: a.witness || [],
    };
  });
  // output dependents
  lazy.prop(o, 'address', () => {
    if (!o.hash) return;
    const payload = new Uint8Array(21);
    tools.writeUInt8(payload, 0, o.network.scriptHash);
    payload.set(o.hash, 1);
    return bs58check_1.default.encode(payload);
  });
  lazy.prop(o, 'hash', () => {
    // in order of least effort
    if (a.output) return a.output.slice(2, 22);
    if (a.address) return _address().hash;
    if (o.redeem && o.redeem.output) return bcrypto.hash160(o.redeem.output);
  });
  lazy.prop(o, 'output', () => {
    if (!o.hash) return;
    return bscript.compile([OPS.OP_HASH160, o.hash, OPS.OP_EQUAL]);
  });
  // input dependents
  lazy.prop(o, 'redeem', () => {
    if (!a.input) return;
    return _redeem();
  });
  lazy.prop(o, 'input', () => {
    if (!a.redeem || !a.redeem.input || !a.redeem.output) return;
    return bscript.compile(
      [].concat(bscript.decompile(a.redeem.input), a.redeem.output),
    );
  });
  lazy.prop(o, 'witness', () => {
    if (o.redeem && o.redeem.witness) return o.redeem.witness;
    if (o.input) return [];
  });
  lazy.prop(o, 'name', () => {
    const nameParts = ['p2sh'];
    if (o.redeem !== undefined && o.redeem.name !== undefined)
      nameParts.push(o.redeem.name);
    return nameParts.join('-');
  });
  if (opts.validate) {
    let hash = Uint8Array.from([]);
    if (a.address) {
      if (_address().version !== network.scriptHash)
        throw new TypeError('Invalid version or Network mismatch');
      if (_address().hash.length !== 20) throw new TypeError('Invalid address');
      hash = _address().hash;
    }
    if (a.hash) {
      if (hash.length > 0 && tools.compare(hash, a.hash) !== 0)
        throw new TypeError('Hash mismatch');
      else hash = a.hash;
    }
    if (a.output) {
      if (
        a.output.length !== 23 ||
        a.output[0] !== OPS.OP_HASH160 ||
        a.output[1] !== 0x14 ||
        a.output[22] !== OPS.OP_EQUAL
      )
        throw new TypeError('Output is invalid');
      const hash2 = a.output.slice(2, 22);
      if (hash.length > 0 && tools.compare(hash, hash2) !== 0)
        throw new TypeError('Hash mismatch');
      else hash = hash2;
    }
    // inlined to prevent 'no-inner-declarations' failing
    const checkRedeem = redeem => {
      // is the redeem output empty/invalid?
      if (redeem.output) {
        const decompile = bscript.decompile(redeem.output);
        if (!decompile || decompile.length < 1)
          throw new TypeError('Redeem.output too short');
        if (redeem.output.byteLength > 520)
          throw new TypeError(
            'Redeem.output unspendable if larger than 520 bytes',
          );
        if (bscript.countNonPushOnlyOPs(decompile) > 201)
          throw new TypeError(
            'Redeem.output unspendable with more than 201 non-push ops',
          );
        // match hash against other sources
        const hash2 = bcrypto.hash160(redeem.output);
        if (hash.length > 0 && tools.compare(hash, hash2) !== 0)
          throw new TypeError('Hash mismatch');
        else hash = hash2;
      }
      if (redeem.input) {
        const hasInput = redeem.input.length > 0;
        const hasWitness = redeem.witness && redeem.witness.length > 0;
        if (!hasInput && !hasWitness) throw new TypeError('Empty input');
        if (hasInput && hasWitness)
          throw new TypeError('Input and witness provided');
        if (hasInput) {
          const richunks = bscript.decompile(redeem.input);
          if (!bscript.isPushOnly(richunks))
            throw new TypeError('Non push-only scriptSig');
        }
      }
    };
    if (a.input) {
      const chunks = _chunks();
      if (!chunks || chunks.length < 1) throw new TypeError('Input too short');
      if (!(_redeem().output instanceof Uint8Array))
        throw new TypeError('Input is invalid');
      checkRedeem(_redeem());
    }
    if (a.redeem) {
      if (a.redeem.network && a.redeem.network !== network)
        throw new TypeError('Network mismatch');
      if (a.input) {
        const redeem = _redeem();
        if (
          a.redeem.output &&
          tools.compare(a.redeem.output, redeem.output) !== 0
        )
          throw new TypeError('Redeem.output mismatch');
        if (a.redeem.input && tools.compare(a.redeem.input, redeem.input) !== 0)
          throw new TypeError('Redeem.input mismatch');
      }
      checkRedeem(a.redeem);
    }
    if (a.witness) {
      if (
        a.redeem &&
        a.redeem.witness &&
        !(0, types_js_1.stacksEqual)(a.redeem.witness, a.witness)
      )
        throw new TypeError('Witness and redeem.witness mismatch');
    }
  }
  return Object.assign(o, a);
}
