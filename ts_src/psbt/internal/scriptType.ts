export type ScriptType =
  | 'witnesspubkeyhash'
  | 'pubkeyhash'
  | 'multisig'
  | 'pubkey'
  | 'nonstandard';

export interface ScriptTypeDeps {
  isP2WPKH(script: Uint8Array): boolean;
  isP2PKH(script: Uint8Array): boolean;
  isP2MS(script: Uint8Array): boolean;
  isP2PK(script: Uint8Array): boolean;
  isP2SHScript(script: Uint8Array): boolean;
  isP2WSHScript(script: Uint8Array): boolean;
  checkRedeemScript(
    index: number,
    script: Uint8Array,
    redeemScript: Uint8Array,
    ioType: 'input' | 'output',
  ): void;
  checkWitnessScript(
    index: number,
    script: Uint8Array,
    witnessScript: Uint8Array,
    ioType: 'input' | 'output',
  ): void;
}

export function classifyScript(
  script: Uint8Array,
  deps: Pick<ScriptTypeDeps, 'isP2WPKH' | 'isP2PKH' | 'isP2MS' | 'isP2PK'>,
): ScriptType {
  if (deps.isP2WPKH(script)) return 'witnesspubkeyhash';
  if (deps.isP2PKH(script)) return 'pubkeyhash';
  if (deps.isP2MS(script)) return 'multisig';
  if (deps.isP2PK(script)) return 'pubkey';
  return 'nonstandard';
}

export function getMeaningfulScript(
  script: Uint8Array,
  index: number,
  ioType: 'input' | 'output',
  redeemScript: Uint8Array | undefined,
  witnessScript: Uint8Array | undefined,
  deps: Pick<
    ScriptTypeDeps,
    | 'isP2SHScript'
    | 'isP2WSHScript'
    | 'isP2WPKH'
    | 'checkRedeemScript'
    | 'checkWitnessScript'
  >,
): {
  meaningfulScript: Uint8Array;
  type: 'p2sh' | 'p2wsh' | 'p2sh-p2wsh' | 'raw';
} {
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

  let meaningfulScript: Uint8Array;

  if (isP2SHP2WSH) {
    meaningfulScript = witnessScript!;
    deps.checkRedeemScript(index, script, redeemScript!, ioType);
    deps.checkWitnessScript(index, redeemScript!, witnessScript!, ioType);
    checkInvalidP2WSH(meaningfulScript, deps.isP2WPKH, deps.isP2SHScript);
  } else if (isP2WSH) {
    meaningfulScript = witnessScript!;
    deps.checkWitnessScript(index, script, witnessScript!, ioType);
    checkInvalidP2WSH(meaningfulScript, deps.isP2WPKH, deps.isP2SHScript);
  } else if (isP2SH) {
    meaningfulScript = redeemScript!;
    deps.checkRedeemScript(index, script, redeemScript!, ioType);
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

export function checkInvalidP2WSH(
  script: Uint8Array,
  isP2WPKH: (script: Uint8Array) => boolean,
  isP2SHScript: (script: Uint8Array) => boolean,
): void {
  if (isP2WPKH(script) || isP2SHScript(script)) {
    throw new Error('P2WPKH or P2SH can not be contained within P2WSH');
  }
}
