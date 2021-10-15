'use strict';
// SegWit version 1 P2TR output type for Taproot defined in
// https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki
Object.defineProperty(exports, '__esModule', { value: true });
exports.p2tr = void 0;
const networks_1 = require('../networks');
const bscript = require('../script');
const taproot = require('../taproot');
const lazy = require('./lazy');
const typef = require('typeforce');
const OPS = bscript.OPS;
const ecc = require('tiny-secp256k1');
const { bech32m } = require('bech32');
/**
 * A secp256k1 x coordinate with unknown discrete logarithm used for eliminating
 * keypath spends, equal to SHA256(uncompressedDER(SECP256K1_GENERATOR_POINT)).
 */
const H = Buffer.from(
  '50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0',
  'hex',
);
const EMPTY_BUFFER = Buffer.alloc(0);
// output: OP_1 {witnessProgram}
function p2tr(a, opts) {
  if (!a.address && !a.pubkey && !a.pubkeys && !a.redeems && !a.output)
    throw new TypeError('Not enough data');
  opts = Object.assign({ validate: true }, opts || {});
  const isXOnlyPoint = pubkey => {
    if (!Buffer.isBuffer(pubkey)) return false;
    return ecc.isPoint(Buffer.concat([taproot.EVEN_Y_COORD_PREFIX, pubkey]));
  };
  typef(
    {
      network: typef.maybe(typef.Object),
      address: typef.maybe(typef.String),
      // the output script should be a fixed 34 bytes.
      // 1 byte for OP_1 indicating segwit version 1, one byte for 0x20 to push
      // the next 32 bytes, followed by the 32 byte witness program
      output: typef.maybe(typef.BufferN(34)),
      // a single pubkey
      pubkey: typef.maybe(isXOnlyPoint),
      // the pub keys used for aggregate musig signing
      pubkeys: typef.maybe(typef.arrayOf(isXOnlyPoint)),
      redeems: typef.maybe(
        typef.arrayOf({
          network: typef.maybe(typef.Object),
          output: typef.maybe(typef.Buffer),
          weight: typef.maybe(typef.Number),
          witness: typef.maybe(typef.arrayOf(typef.Buffer)),
        }),
      ),
      redeemIndex: typef.maybe(typef.Number), // Selects the redeem to spend
    },
    a,
  );
  const _address = lazy.value(() => {
    const result = bech32m.decode(a.address);
    const version = result.words.shift();
    const data = bech32m.fromWords(result.words);
    return {
      version,
      prefix: result.prefix,
      data: Buffer.from(data),
    };
  });
  const _rchunks = lazy.value(() => {
    const chosen = a.redeems[a.redeemIndex]; // These not-nulls are enforced at the call site.
    return bscript.decompile(chosen.input);
  });
  const _taptree = lazy.value(() => {
    if (!a.redeems) return;
    const outputs = a.redeems.map(({ output }) => output);
    if (!outputs.every(output => output)) return;
    return taproot.getHuffmanTaptree(
      outputs,
      a.redeems.map(({ weight }) => weight),
    );
  });
  const _internalPubkey = lazy.value(() => {
    if (a.pubkey) {
      // single pubkey
      return a.pubkey;
    } else if (a.pubkeys && a.pubkeys.length) {
      // multiple pubkeys
      return taproot.aggregateMuSigPubkeys(a.pubkeys);
    } else {
      // no key path
      if (!a.redeems) return; // must have either redeems or pubkey(s)
      // If there is no key path spending condition, we use an internal key with unknown secret key.
      // TODO: In order to avoid leaking the information that key path spending is not possible it
      // is recommended to pick a fresh integer r in the range 0...n-1 uniformly at random and use
      // H + rG as internal key. It is possible to prove that this internal key does not have a
      // known discrete logarithm with respect to G by revealing r to a verifier who can then
      // reconstruct how the internal key was created.
      return H;
    }
  });
  const _taprootPubkey = lazy.value(() => {
    const internalPubkey = _internalPubkey();
    if (!internalPubkey) return;
    const taptree = _taptree();
    return taproot.tapTweakPubkey(
      internalPubkey,
      taptree ? taptree.root : undefined,
    );
  });
  const network = a.network || networks_1.bitcoin;
  const o = { network };
  lazy.prop(o, 'address', () => {
    if (!o.output) return;
    // we remove the first two bytes (OP_1 0x20) from the output script to
    // only encode the 32 byte witness program as bech32m
    const words = bech32m.toWords(o.output.slice(2));
    words.unshift(0x01);
    return bech32m.encode(network.bech32, words);
  });
  lazy.prop(o, 'output', () => {
    if (a.address) {
      const { data } = _address();
      return bscript.compile([OPS.OP_1, data]);
    }
    const taprootPubkey = _taprootPubkey();
    if (!taprootPubkey) return;
    // OP_1 indicates segwit version 1
    return bscript.compile([OPS.OP_1, taprootPubkey.pubkey]);
  });
  lazy.prop(o, 'witness', () => {
    if (!a.redeems || a.redeemIndex === undefined) return; // No chosen redeem script, can't make witness
    const chosen = a.redeems[a.redeemIndex];
    if (!chosen) return;
    // transform redeem input to witness stack?
    if (
      chosen.input &&
      chosen.input.length > 0 &&
      chosen.output &&
      chosen.output.length > 0
    ) {
      const stack = bscript.toStack(_rchunks());
      // assign, and blank the existing input
      o.redeems[a.redeemIndex] = Object.assign({ witness: stack }, chosen);
      o.redeems[a.redeemIndex].input = EMPTY_BUFFER;
      return stack.concat(
        chosen.output,
        taproot.getControlBlock(
          _taprootPubkey().parity,
          _internalPubkey(),
          _taptree().paths[a.redeemIndex],
        ),
      );
    }
    if (!chosen.output) return;
    if (!chosen.witness) return;
    return chosen.witness.concat([
      chosen.output,
      taproot.getControlBlock(
        _taprootPubkey().parity,
        _internalPubkey(),
        _taptree().paths[a.redeemIndex],
      ),
    ]);
  });
  lazy.prop(o, 'name', () => {
    const nameParts = ['p2tr'];
    return nameParts.join('-');
  });
  // extended validation
  if (opts.validate) {
    // TODO: complete extended validation
    if (a.output) {
      if (a.output[0] !== OPS.OP_1 || a.output[1] !== 0x20)
        throw new TypeError('Output is invalid');
    }
    if (a.redeems) {
      a.redeems.forEach(redeem => {
        if (redeem.network && redeem.network !== network)
          throw new TypeError('Network mismatch');
      });
    }
    if (a.redeemIndex !== undefined && a.redeems) {
      if (a.redeemIndex < 0 || a.redeemIndex >= a.redeems.length)
        throw new TypeError(
          'Redeem index must be 0 <= redeemIndex < redeems.length',
        );
    }
  }
  return Object.assign(o, a);
}
exports.p2tr = p2tr;
