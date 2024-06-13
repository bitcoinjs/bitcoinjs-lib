'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.p2data = void 0;
const networks_1 = require('../networks');
const bscript = require('../script');
const types_1 = require('../types');
const lazy = require('./lazy');
const OPS = bscript.OPS;
// output: OP_RETURN ...
/**
 * Embeds data in a Bitcoin payment.
 * @param a - The payment object.
 * @param opts - Optional payment options.
 * @returns The modified payment object.
 * @throws {TypeError} If there is not enough data or if the output is invalid.
 */
function p2data(a, opts) {
  if (!a.data && !a.output) throw new TypeError('Not enough data');
  opts = Object.assign({ validate: true }, opts || {});
  (0, types_1.typeforce)(
    {
      network: types_1.typeforce.maybe(types_1.typeforce.Object),
      output: types_1.typeforce.maybe(types_1.typeforce.Buffer),
      data: types_1.typeforce.maybe(
        types_1.typeforce.arrayOf(types_1.typeforce.Buffer),
      ),
    },
    a,
  );
  const network = a.network || networks_1.bitcoin;
  const o = { name: 'embed', network };
  lazy.prop(o, 'output', () => {
    if (!a.data) return;
    return bscript.compile([OPS.OP_RETURN].concat(a.data));
  });
  lazy.prop(o, 'data', () => {
    if (!a.output) return;
    return bscript.decompile(a.output).slice(1);
  });
  // extended validation
  if (opts.validate) {
    if (a.output) {
      const chunks = bscript.decompile(a.output);
      if (chunks[0] !== OPS.OP_RETURN) throw new TypeError('Output is invalid');
      if (!chunks.slice(1).every(types_1.typeforce.Buffer))
        throw new TypeError('Output is invalid');
      if (a.data && !(0, types_1.stacksEqual)(a.data, o.data))
        throw new TypeError('Data mismatch');
    }
  }
  return Object.assign(o, a);
}
exports.p2data = p2data;
