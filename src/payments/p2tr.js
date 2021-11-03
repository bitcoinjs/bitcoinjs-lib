'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.p2tr = void 0;
const buffer_1 = require('buffer');
const networks_1 = require('../networks');
const bscript = require('../script');
const types_1 = require('../types');
const taproot_1 = require('../taproot');
const lazy = require('./lazy');
const bech32_1 = require('bech32');
const OPS = bscript.OPS;
const TAPROOT_VERSION = 0x01;
const ANNEX_PREFIX = 0x50;
function p2tr(a, opts) {
  if (
    !a.address &&
    !a.output &&
    !a.pubkey &&
    !a.output &&
    !a.internalPubkey &&
    !(a.witness && a.witness.length > 1)
  )
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
      // scriptsTree: typef.maybe(typef.TaprootNode), // use merkel.isMast ?
      scriptLeaf: types_1.typeforce.maybe({
        version: types_1.typeforce.maybe(types_1.typeforce.Number),
        output: types_1.typeforce.maybe(types_1.typeforce.Buffer),
      }),
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
      data: buffer_1.Buffer.from(data),
    };
  });
  const _witness = lazy.value(() => {
    if (!a.witness || !a.witness.length) return;
    if (
      a.witness.length >= 2 &&
      a.witness[a.witness.length - 1][0] === ANNEX_PREFIX
    ) {
      // remove annex, ignored by taproot
      return a.witness.slice(0, -1);
    }
    return a.witness.slice();
  });
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
    if (a.scriptsTree) return (0, taproot_1.toHashTree)(a.scriptsTree).hash;
    const w = _witness();
    if (w && w.length > 1) {
      const controlBlock = w[w.length - 1];
      const leafVersion = controlBlock[0] & 0b11111110;
      const script = w[w.length - 2];
      const leafHash = (0, taproot_1.tapLeafHash)(script, leafVersion);
      return (0, taproot_1.rootHashFromPath)(controlBlock, leafHash);
    }
    return null;
  });
  lazy.prop(o, 'output', () => {
    if (!o.pubkey) return;
    return bscript.compile([OPS.OP_1, o.pubkey]);
  });
  lazy.prop(o, 'scriptLeaf', () => {
    if (a.scriptLeaf) return a.scriptLeaf;
  });
  lazy.prop(o, 'pubkey', () => {
    if (a.pubkey) return a.pubkey;
    if (a.output) return a.output.slice(2);
    if (a.address) return _address().data;
    if (o.internalPubkey) {
      const tweakedKey = (0, taproot_1.tweakKey)(o.internalPubkey, o.hash);
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
    if (!a.witness || a.witness.length !== 1) return;
    return a.witness[0];
  });
  lazy.prop(o, 'input', () => {
    // todo
  });
  lazy.prop(o, 'witness', () => {
    if (a.witness) return a.witness;
    if (a.scriptsTree && a.scriptLeaf && a.internalPubkey) {
      // todo: optimize/cache
      const hashTree = (0, taproot_1.toHashTree)(a.scriptsTree);
      const leafHash = (0, taproot_1.tapLeafHash)(
        a.scriptLeaf.output,
        a.scriptLeaf.version,
      );
      const path = (0, taproot_1.findScriptPath)(hashTree, leafHash);
      const outputKey = (0, taproot_1.tweakKey)(
        a.internalPubkey,
        hashTree.hash,
      );
      if (!outputKey) return;
      const version = a.scriptLeaf.version || 0xc0;
      const controlBock = buffer_1.Buffer.concat(
        [
          buffer_1.Buffer.from([version | outputKey.parity]),
          a.internalPubkey,
        ].concat(path.reverse()),
      );
      return [a.scriptLeaf.output, controlBock];
    }
    if (a.signature) return [a.signature];
  });
  // extended validation
  if (opts.validate) {
    let pubkey = buffer_1.Buffer.from([]);
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
    if (a.internalPubkey) {
      const tweakedKey = (0, taproot_1.tweakKey)(a.internalPubkey, o.hash);
      if (tweakedKey === null)
        throw new TypeError('Invalid internalPubkey for p2tr');
      if (pubkey.length > 0 && !pubkey.equals(tweakedKey.x))
        throw new TypeError('Pubkey mismatch');
      else pubkey = tweakedKey.x;
    }
    if (pubkey && pubkey.length) {
      if ((0, taproot_1.liftX)(pubkey) === null)
        throw new TypeError('Invalid pubkey for p2tr');
    }
    if (a.hash && a.scriptsTree) {
      const hash = (0, taproot_1.toHashTree)(a.scriptsTree).hash;
      if (!a.hash.equals(hash)) throw new TypeError('Hash mismatch');
    }
    const witness = _witness();
    if (witness && witness.length) {
      if (witness.length === 1) {
        // key spending
        if (a.signature && !a.signature.equals(witness[0]))
          throw new TypeError('Signature mismatch');
        // todo: recheck
        // if (!bscript.isSchnorSignature(a.pubkey, a.witness[0]))
        // throw new TypeError('Witness has invalid signature');
      } else {
        // script path spending
        const controlBlock = witness[witness.length - 1];
        if (controlBlock.length < 33)
          throw new TypeError(
            `The control-block length is too small. Got ${
              controlBlock.length
            }, expected min 33.`,
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
        if (a.internalPubkey && !a.internalPubkey.equals(internalPubkey))
          throw new TypeError('Internal pubkey mismatch');
        const internalPubkeyPoint = (0, taproot_1.liftX)(internalPubkey);
        if (!internalPubkeyPoint)
          throw new TypeError('Invalid internalPubkey for p2tr witness');
        const leafVersion = controlBlock[0] & 0b11111110;
        const script = witness[witness.length - 2];
        const leafHash = (0, taproot_1.tapLeafHash)(script, leafVersion);
        const hash = (0, taproot_1.rootHashFromPath)(controlBlock, leafHash);
        const outputKey = (0, taproot_1.tweakKey)(internalPubkey, hash);
        if (!outputKey)
          // todo: needs test data
          throw new TypeError('Invalid outputKey for p2tr witness');
        if (pubkey.length && !pubkey.equals(outputKey.x))
          throw new TypeError('Pubkey mismatch for p2tr witness');
        if (outputKey.parity !== (controlBlock[0] & 1))
          throw new Error('Incorrect parity');
      }
    }
  }
  return Object.assign(o, a);
}
exports.p2tr = p2tr;
