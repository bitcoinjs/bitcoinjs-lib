// {signature}
// TODO: define p2tr script path input template

import * as bscript from '../../script';

export function check(chunks: Buffer[]): boolean {
  return chunks.length === 1 && bscript.isCanonicalSchnorrSignature(chunks[0]);
}
check.toJSON = (): string => {
  return 'taproot input';
};
