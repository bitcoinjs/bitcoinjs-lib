// {signature} {pubKey}

import * as bscript from '../../script';

export function check(script: Buffer | Array<number | Buffer>): boolean {
  const chunks = <Array<number | Buffer>>bscript.decompile(script);

  return (
    chunks.length === 2 &&
    bscript.isCanonicalScriptSignature(<Buffer>chunks[0]) &&
    bscript.isCanonicalPubKey(<Buffer>chunks[1])
  );
}
check.toJSON = function() {
  return 'pubKeyHash input';
};
