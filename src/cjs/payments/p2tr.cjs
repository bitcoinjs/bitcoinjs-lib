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
exports.p2tr = p2tr;
const networks_js_1 = require('../networks.cjs');
const bscript = __importStar(require('../script.cjs'));
const types_js_1 = require('../types.cjs');
const ecc_lib_js_1 = require('../ecc_lib.cjs');
const bip341_js_1 = require('./bip341.cjs');
const lazy = __importStar(require('./lazy.cjs'));
const bech32_1 = require('bech32');
const address_js_1 = require('../address.cjs');
const tools = __importStar(require('uint8array-tools'));
const v = __importStar(require('valibot'));
const OPS = bscript.OPS;
const TAPROOT_WITNESS_VERSION = 0x01;
const ANNEX_PREFIX = 0x50;
/**
 * Creates a Pay-to-Taproot (P2TR) payment object.
 *
 * @param a - The payment object containing the necessary data for P2TR.
 * @param opts - Optional payment options.
 * @returns The P2TR payment object.
 * @throws {TypeError} If the provided data is invalid or insufficient.
 */
function p2tr(a, opts) {
  if (
    !a.address &&
    !a.output &&
    !a.pubkey &&
    !a.internalPubkey &&
    !(a.witness && a.witness.length > 1)
  )
    throw new TypeError('Not enough data');
  opts = Object.assign({ validate: true }, opts || {});
  v.parse(
    v.partial(
      v.object({
        address: v.string(),
        input: (0, types_js_1.NBufferSchemaFactory)(0),
        network: v.object({}),
        output: (0, types_js_1.NBufferSchemaFactory)(34),
        internalPubkey: (0, types_js_1.NBufferSchemaFactory)(32),
        hash: (0, types_js_1.NBufferSchemaFactory)(32), // merkle root hash, the tweak
        pubkey: (0, types_js_1.NBufferSchemaFactory)(32), // tweaked with `hash` from `internalPubkey`
        signature: v.union([
          (0, types_js_1.NBufferSchemaFactory)(64),
          (0, types_js_1.NBufferSchemaFactory)(65),
        ]),
        witness: v.array(types_js_1.BufferSchema),
        scriptTree: v.custom(
          types_js_1.isTaptree,
          'Taptree is not of type isTaptree',
        ),
        redeem: v.partial(
          v.object({
            output: types_js_1.BufferSchema, // tapleaf script
            redeemVersion: v.number(), // tapleaf version
            witness: v.array(types_js_1.BufferSchema),
          }),
        ),
        redeemVersion: v.number(),
      }),
    ),
    a,
  );
  const _address = lazy.value(() => {
    return (0, address_js_1.fromBech32)(a.address);
  });
  // remove annex if present, ignored by taproot
  const _witness = lazy.value(() => {
    if (!a.witness || !a.witness.length) return;
    if (
      a.witness.length >= 2 &&
      a.witness[a.witness.length - 1][0] === ANNEX_PREFIX
    ) {
      return a.witness.slice(0, -1);
    }
    return a.witness.slice();
  });
  const _hashTree = lazy.value(() => {
    if (a.scriptTree) return (0, bip341_js_1.toHashTree)(a.scriptTree);
    if (a.hash) return { hash: a.hash };
    return;
  });
  const network = a.network || networks_js_1.bitcoin;
  const o = { name: 'p2tr', network };
  lazy.prop(o, 'address', () => {
    if (!o.pubkey) return;
    const words = bech32_1.bech32m.toWords(o.pubkey);
    words.unshift(TAPROOT_WITNESS_VERSION);
    return bech32_1.bech32m.encode(network.bech32, words);
  });
  lazy.prop(o, 'hash', () => {
    const hashTree = _hashTree();
    if (hashTree) return hashTree.hash;
    const w = _witness();
    if (w && w.length > 1) {
      const controlBlock = w[w.length - 1];
      const leafVersion = controlBlock[0] & types_js_1.TAPLEAF_VERSION_MASK;
      const script = w[w.length - 2];
      const leafHash = (0, bip341_js_1.tapleafHash)({
        output: script,
        version: leafVersion,
      });
      return (0, bip341_js_1.rootHashFromPath)(controlBlock, leafHash);
    }
    return null;
  });
  lazy.prop(o, 'output', () => {
    if (!o.pubkey) return;
    return bscript.compile([OPS.OP_1, o.pubkey]);
  });
  lazy.prop(o, 'redeemVersion', () => {
    if (a.redeemVersion) return a.redeemVersion;
    if (
      a.redeem &&
      a.redeem.redeemVersion !== undefined &&
      a.redeem.redeemVersion !== null
    ) {
      return a.redeem.redeemVersion;
    }
    return bip341_js_1.LEAF_VERSION_TAPSCRIPT;
  });
  lazy.prop(o, 'redeem', () => {
    const witness = _witness(); // witness without annex
    if (!witness || witness.length < 2) return;
    return {
      output: witness[witness.length - 2],
      witness: witness.slice(0, -2),
      redeemVersion:
        witness[witness.length - 1][0] & types_js_1.TAPLEAF_VERSION_MASK,
    };
  });
  lazy.prop(o, 'pubkey', () => {
    if (a.pubkey) return a.pubkey;
    if (a.output) return a.output.slice(2);
    if (a.address) return _address().data;
    if (o.internalPubkey) {
      const tweakedKey = (0, bip341_js_1.tweakKey)(o.internalPubkey, o.hash);
      if (tweakedKey) return tweakedKey.x;
    }
  });
  lazy.prop(o, 'internalPubkey', () => {
    if (a.internalPubkey) return a.internalPubkey;
    const witness = _witness();
    if (witness && witness.length > 1)
      return witness[witness.length - 1].slice(1, 33);
  });
  lazy.prop(o, 'signature', () => {
    if (a.signature) return a.signature;
    const witness = _witness(); // witness without annex
    if (!witness || witness.length !== 1) return;
    return witness[0];
  });
  lazy.prop(o, 'witness', () => {
    if (a.witness) return a.witness;
    const hashTree = _hashTree();
    if (hashTree && a.redeem && a.redeem.output && a.internalPubkey) {
      const leafHash = (0, bip341_js_1.tapleafHash)({
        output: a.redeem.output,
        version: o.redeemVersion,
      });
      const path = (0, bip341_js_1.findScriptPath)(hashTree, leafHash);
      if (!path) return;
      const outputKey = (0, bip341_js_1.tweakKey)(
        a.internalPubkey,
        hashTree.hash,
      );
      if (!outputKey) return;
      const controlBock = tools.concat(
        [
          Uint8Array.from([o.redeemVersion | outputKey.parity]),
          a.internalPubkey,
        ].concat(path),
      );
      return [a.redeem.output, controlBock];
    }
    if (a.signature) return [a.signature];
  });
  // extended validation
  if (opts.validate) {
    let pubkey = Uint8Array.from([]);
    if (a.address) {
      if (network && network.bech32 !== _address().prefix)
        throw new TypeError('Invalid prefix or Network mismatch');
      if (_address().version !== TAPROOT_WITNESS_VERSION)
        throw new TypeError('Invalid address version');
      if (_address().data.length !== 32)
        throw new TypeError('Invalid address data');
      pubkey = _address().data;
    }
    if (a.pubkey) {
      if (pubkey.length > 0 && tools.compare(pubkey, a.pubkey) !== 0)
        throw new TypeError('Pubkey mismatch');
      else pubkey = a.pubkey;
    }
    if (a.output) {
      if (
        a.output.length !== 34 ||
        a.output[0] !== OPS.OP_1 ||
        a.output[1] !== 0x20
      )
        throw new TypeError('Output is invalid');
      if (pubkey.length > 0 && tools.compare(pubkey, a.output.slice(2)) !== 0)
        throw new TypeError('Pubkey mismatch');
      else pubkey = a.output.slice(2);
    }
    if (a.internalPubkey) {
      const tweakedKey = (0, bip341_js_1.tweakKey)(a.internalPubkey, o.hash);
      if (pubkey.length > 0 && tools.compare(pubkey, tweakedKey.x) !== 0)
        throw new TypeError('Pubkey mismatch');
      else pubkey = tweakedKey.x;
    }
    if (pubkey && pubkey.length) {
      if (!(0, ecc_lib_js_1.getEccLib)().isXOnlyPoint(pubkey))
        throw new TypeError('Invalid pubkey for p2tr');
    }
    const hashTree = _hashTree();
    if (a.hash && hashTree) {
      if (tools.compare(a.hash, hashTree.hash) !== 0)
        throw new TypeError('Hash mismatch');
    }
    if (a.redeem && a.redeem.output && hashTree) {
      const leafHash = (0, bip341_js_1.tapleafHash)({
        output: a.redeem.output,
        version: o.redeemVersion,
      });
      if (!(0, bip341_js_1.findScriptPath)(hashTree, leafHash))
        throw new TypeError('Redeem script not in tree');
    }
    const witness = _witness();
    // compare the provided redeem data with the one computed from witness
    if (a.redeem && o.redeem) {
      if (a.redeem.redeemVersion) {
        if (a.redeem.redeemVersion !== o.redeem.redeemVersion)
          throw new TypeError('Redeem.redeemVersion and witness mismatch');
      }
      if (a.redeem.output) {
        if (bscript.decompile(a.redeem.output).length === 0)
          throw new TypeError('Redeem.output is invalid');
        // output redeem is constructed from the witness
        if (
          o.redeem.output &&
          tools.compare(a.redeem.output, o.redeem.output) !== 0
        )
          throw new TypeError('Redeem.output and witness mismatch');
      }
      if (a.redeem.witness) {
        if (
          o.redeem.witness &&
          !(0, types_js_1.stacksEqual)(a.redeem.witness, o.redeem.witness)
        )
          throw new TypeError('Redeem.witness and witness mismatch');
      }
    }
    if (witness && witness.length) {
      if (witness.length === 1) {
        // key spending
        if (a.signature && tools.compare(a.signature, witness[0]) !== 0)
          throw new TypeError('Signature mismatch');
      } else {
        // script path spending
        const controlBlock = witness[witness.length - 1];
        if (controlBlock.length < 33)
          throw new TypeError(
            `The control-block length is too small. Got ${controlBlock.length}, expected min 33.`,
          );
        if ((controlBlock.length - 33) % 32 !== 0)
          throw new TypeError(
            `The control-block length of ${controlBlock.length} is incorrect!`,
          );
        const m = (controlBlock.length - 33) / 32;
        if (m > 128)
          throw new TypeError(
            `The script path is too long. Got ${m}, expected max 128.`,
          );
        const internalPubkey = controlBlock.slice(1, 33);
        if (
          a.internalPubkey &&
          tools.compare(a.internalPubkey, internalPubkey) !== 0
        )
          throw new TypeError('Internal pubkey mismatch');
        if (!(0, ecc_lib_js_1.getEccLib)().isXOnlyPoint(internalPubkey))
          throw new TypeError('Invalid internalPubkey for p2tr witness');
        const leafVersion = controlBlock[0] & types_js_1.TAPLEAF_VERSION_MASK;
        const script = witness[witness.length - 2];
        const leafHash = (0, bip341_js_1.tapleafHash)({
          output: script,
          version: leafVersion,
        });
        const hash = (0, bip341_js_1.rootHashFromPath)(controlBlock, leafHash);
        const outputKey = (0, bip341_js_1.tweakKey)(internalPubkey, hash);
        if (!outputKey)
          // todo: needs test data
          throw new TypeError('Invalid outputKey for p2tr witness');
        if (pubkey.length && tools.compare(pubkey, outputKey.x) !== 0)
          throw new TypeError('Pubkey mismatch for p2tr witness');
        if (outputKey.parity !== (controlBlock[0] & 1))
          throw new Error('Incorrect parity');
      }
    }
  }
  return Object.assign(o, a);
}
