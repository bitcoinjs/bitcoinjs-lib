// OP_RETURN {aa21a9ed} {commitment}

import * as bscript from '../../script';
import { OPS } from '../../script';
import * as types from '../../types';

const typeforce = require('typeforce');

const HEADER: Buffer = Buffer.from('aa21a9ed', 'hex');

export function check(script: Buffer | Array<number | Buffer>): boolean {
  const buffer = bscript.compile(script);

  return (
    buffer.length > 37 &&
    buffer[0] === OPS.OP_RETURN &&
    buffer[1] === 0x24 &&
    buffer.slice(2, 6).equals(HEADER)
  );
}

check.toJSON = (): string => {
  return 'Witness commitment output';
};

export function encode(commitment: Buffer): Buffer {
  typeforce(types.Hash256bit, commitment);

  const buffer = Buffer.allocUnsafe(36);
  HEADER.copy(buffer, 0);
  commitment.copy(buffer, 4);

  return bscript.compile([OPS.OP_RETURN, buffer]);
}

export function decode(buffer: Buffer): Buffer {
  typeforce(check, buffer);

  return (bscript.decompile(buffer)![1] as Buffer).slice(4, 36);
}
