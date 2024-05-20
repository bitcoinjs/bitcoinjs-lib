'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.pubkeyInOutput = void 0;
const script_1 = require('../input/script');
function pubkeyInOutput(pubkey, output, outputIndex, cache) {
  const script = cache.__TX.outs[outputIndex].script;
  const { meaningfulScript } = (0, script_1.getMeaningfulScript)(
    script,
    outputIndex,
    'output',
    output.redeemScript,
    output.witnessScript,
  );
  return (0, script_1.pubkeyInScript)(pubkey, meaningfulScript);
}
exports.pubkeyInOutput = pubkeyInOutput;
