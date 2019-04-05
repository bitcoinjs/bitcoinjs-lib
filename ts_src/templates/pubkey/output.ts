// {pubKey} OP_CHECKSIG

import { Stack } from '../../payments';
import * as bscript from '../../script';
import { OPS } from '../../script';

export function check(script: Buffer | Stack): boolean {
  const chunks = bscript.decompile(script) as Stack;

  return (
    chunks.length === 2 &&
    bscript.isCanonicalPubKey(chunks[0] as Buffer) &&
    chunks[1] === OPS.OP_CHECKSIG
  );
}
check.toJSON = (): string => {
  return 'pubKey output';
};
