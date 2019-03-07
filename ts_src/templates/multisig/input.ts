// OP_0 [signatures ...]

import * as bscript from '../../script';
import { OPS } from '../../script';

function partialSignature(value: number | Buffer): boolean {
  return (
    value === OPS.OP_0 || bscript.isCanonicalScriptSignature(<Buffer>value)
  );
}

export function check(
  script: Buffer | Array<number | Buffer>,
  allowIncomplete?: boolean,
): boolean {
  const chunks = <Array<number | Buffer>>bscript.decompile(script);
  if (chunks.length < 2) return false;
  if (chunks[0] !== OPS.OP_0) return false;

  if (allowIncomplete) {
    return chunks.slice(1).every(partialSignature);
  }

  return (<Array<Buffer>>chunks.slice(1)).every(
    bscript.isCanonicalScriptSignature,
  );
}
check.toJSON = function() {
  return 'multisig input';
};
