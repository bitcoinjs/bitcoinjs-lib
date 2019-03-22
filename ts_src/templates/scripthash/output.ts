// OP_HASH160 {scriptHash} OP_EQUAL

import * as bscript from '../../script';
import { OPS } from '../../script';

export function check(script: Buffer | Array<number | Buffer>): boolean {
  const buffer = bscript.compile(script);

  return (
    buffer.length === 23 &&
    buffer[0] === OPS.OP_HASH160 &&
    buffer[1] === 0x14 &&
    buffer[22] === OPS.OP_EQUAL
  );
}
check.toJSON = (): string => {
  return 'scriptHash output';
};
