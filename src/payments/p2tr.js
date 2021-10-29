'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.p2tr = void 0;
const networks_1 = require('../networks');
const bscript = require('../script');
const types_1 = require('../types');
const lazy = require('./lazy');
const bech32_1 = require('bech32');
const OPS = bscript.OPS;
const TAPROOT_VERSION = 0x01;
// witness: {signature}
// input: <>
// output: OP_1 {pubKey}
function p2tr(a, opts) {
  if (!a.address && !a.output && !a.pubkey && !a.output && !a.internalPubkey)
    throw new TypeError('Not enough data');
  opts = Object.assign({ validate: true }, opts || {});
  (0, types_1.typeforce)(
    {
      address: types_1.typeforce.maybe(types_1.typeforce.String),
      input: types_1.typeforce.maybe(types_1.typeforce.BufferN(0)),
      network: types_1.typeforce.maybe(types_1.typeforce.Object),
      output: types_1.typeforce.maybe(types_1.typeforce.BufferN(34)),
      internalPubkey: types_1.typeforce.maybe(types_1.typeforce.BufferN(32)),
      hash: types_1.typeforce.maybe(types_1.typeforce.BufferN(32)),
      pubkey: types_1.typeforce.maybe(types_1.typeforce.BufferN(32)),
      signature: types_1.typeforce.maybe(bscript.isCanonicalScriptSignature),
      witness: types_1.typeforce.maybe(
        types_1.typeforce.arrayOf(types_1.typeforce.Buffer),
      ),
    },
    a,
  );
  const _address = lazy.value(() => {
    const result = bech32_1.bech32m.decode(a.address);
    const version = result.words.shift();
    const data = bech32_1.bech32m.fromWords(result.words);
    return {
      version,
      prefix: result.prefix,
      data: Buffer.from(data),
    };
  });
  // todo: clean-up withness (annex), etc
  const network = a.network || networks_1.bitcoin;
  const o = { name: 'p2tr', network };
  lazy.prop(o, 'address', () => {
    if (!o.pubkey) return;
    const words = bech32_1.bech32m.toWords(o.pubkey);
    words.unshift(TAPROOT_VERSION);
    return bech32_1.bech32m.encode(network.bech32, words);
  });
  lazy.prop(o, 'hash', () => {
    if (a.hash) return a.hash;
    // todo: if (a.redeems?.length) compute from MAST root from redeems
    return null;
  });
  lazy.prop(o, 'output', () => {
    if (!o.pubkey) return;
    return bscript.compile([OPS.OP_1, o.pubkey]);
  });
  lazy.prop(o, 'pubkey', () => {
    if (a.pubkey) return a.pubkey;
    if (a.output) return a.output.slice(2);
    if (a.address) return _address().data;
    if (a.internalPubkey) {
      const tweakedKey = (0, types_1.tweakPublicKey)(a.internalPubkey, o.hash);
      if (tweakedKey) return tweakedKey.x;
    }
    return null;
  });
  lazy.prop(o, 'signature', () => {
    if (a.witness?.length !== 1) return;
    return a.witness[0];
  });
  lazy.prop(o, 'input', () => {
    // todo: not sure
  });
  lazy.prop(o, 'witness', () => {
    if (!a.signature) return;
    return [a.signature];
  });
  // extended validation
  if (opts.validate) {
    let pubkey = Buffer.from([]);
    if (a.address) {
      if (network && network.bech32 !== _address().prefix)
        throw new TypeError('Invalid prefix or Network mismatch');
      if (_address().version !== TAPROOT_VERSION)
        throw new TypeError('Invalid address version');
      if (_address().data.length !== 32)
        throw new TypeError('Invalid address data');
      pubkey = _address().data;
    }
    if (a.pubkey) {
      if (pubkey.length > 0 && !pubkey.equals(a.pubkey))
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
      if (pubkey.length > 0 && !pubkey.equals(a.output.slice(2)))
        throw new TypeError('Pubkey mismatch');
      else pubkey = a.output.slice(2);
    }
    // todo: optimze o.hash?
    if (a.internalPubkey) {
      const tweakedKey = (0, types_1.tweakPublicKey)(a.internalPubkey, o.hash);
      if (tweakedKey === null)
        throw new TypeError('Invalid internalPubkey for p2tr');
      if (pubkey.length > 0 && !pubkey.equals(tweakedKey.x))
        throw new TypeError('Pubkey mismatch');
      else pubkey = tweakedKey.x;
    }
    if (pubkey?.length) {
      if ((0, types_1.liftX)(pubkey) === null)
        throw new TypeError('Invalid pubkey for p2tr');
    }
    if (a.witness) {
      if (a.witness.length !== 1) throw new TypeError('Witness is invalid');
      // todo: recheck
      // if (!bscript.isCanonicalScriptSignature(a.witness[0]))
      // throw new TypeError('Witness has invalid signature');
      if (a.signature && !a.signature.equals(a.witness[0]))
        throw new TypeError('Signature mismatch');
    }
  }
  return Object.assign(o, a);
}
exports.p2tr = p2tr;
