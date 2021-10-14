// OP_1 {scriptHash}

import * as bscript from '../../script';
import { OPS } from '../../script';

export function check(script: Buffer | Array<number | Buffer>): boolean {
  const buffer = bscript.compile(script);

  return buffer.length === 34 && buffer[0] === OPS.OP_1 && buffer[1] === 0x20;
}
check.toJSON = (): string => {
  return 'Taproot output';
};
