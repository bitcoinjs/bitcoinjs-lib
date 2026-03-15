'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.classifyScript = classifyScript;
exports.getMeaningfulScript = getMeaningfulScript;
exports.checkInvalidP2WSH = checkInvalidP2WSH;
function classifyScript(script, deps) {
  if (deps.isP2WPKH(script)) return 'witnesspubkeyhash';
  if (deps.isP2PKH(script)) return 'pubkeyhash';
  if (deps.isP2MS(script)) return 'multisig';
  if (deps.isP2PK(script)) return 'pubkey';
  return 'nonstandard';
}
function getMeaningfulScript(
  script,
  index,
  ioType,
  redeemScript,
  witnessScript,
  deps,
) {
  const isP2SH = deps.isP2SHScript(script);
  const isP2SHP2WSH =
    isP2SH && redeemScript && deps.isP2WSHScript(redeemScript);
  const isP2WSH = deps.isP2WSHScript(script);
  if (isP2SH && redeemScript === undefined)
    throw new Error('scriptPubkey is P2SH but redeemScript missing');
  if ((isP2WSH || isP2SHP2WSH) && witnessScript === undefined)
    throw new Error(
      'scriptPubkey or redeemScript is P2WSH but witnessScript missing',
    );
  let meaningfulScript;
  if (isP2SHP2WSH) {
    meaningfulScript = witnessScript;
    deps.checkRedeemScript(index, script, redeemScript, ioType);
    deps.checkWitnessScript(index, redeemScript, witnessScript, ioType);
    checkInvalidP2WSH(meaningfulScript, deps.isP2WPKH, deps.isP2SHScript);
  } else if (isP2WSH) {
    meaningfulScript = witnessScript;
    deps.checkWitnessScript(index, script, witnessScript, ioType);
    checkInvalidP2WSH(meaningfulScript, deps.isP2WPKH, deps.isP2SHScript);
  } else if (isP2SH) {
    meaningfulScript = redeemScript;
    deps.checkRedeemScript(index, script, redeemScript, ioType);
  } else {
    meaningfulScript = script;
  }
  return {
    meaningfulScript,
    type: isP2SHP2WSH
      ? 'p2sh-p2wsh'
      : isP2SH
        ? 'p2sh'
        : isP2WSH
          ? 'p2wsh'
          : 'raw',
  };
}
function checkInvalidP2WSH(script, isP2WPKH, isP2SHScript) {
  if (isP2WPKH(script) || isP2SHScript(script)) {
    throw new Error('P2WPKH or P2SH can not be contained within P2WSH');
  }
}
