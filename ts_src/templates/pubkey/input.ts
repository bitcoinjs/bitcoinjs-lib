// {signature}

import * as bscript from '../../script';

export function check(script: Buffer | Array<number | Buffer>): boolean {
  const chunks = <Array<number | Buffer>>bscript.decompile(script);

  return (
    chunks.length === 1 && bscript.isCanonicalScriptSignature(<Buffer>chunks[0])
  );
}
check.toJSON = function() {
  return 'pubKey input';
};
