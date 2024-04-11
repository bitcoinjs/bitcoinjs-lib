import { PsbtOutput } from "bip174/src/lib/interfaces";
import { PsbtCache } from "../interfaces";
import { getMeaningfulScript } from "../input/script";
import { pubkeyInScript } from "../psbtutils";

export function pubkeyInOutput(
  pubkey: Buffer,
  output: PsbtOutput,
  outputIndex: number,
  cache: PsbtCache,
): boolean {
  const script = cache.__TX.outs[outputIndex].script;
  const { meaningfulScript } = getMeaningfulScript(
    script,
    outputIndex,
    'output',
    output.redeemScript,
    output.witnessScript,
  );
  return pubkeyInScript(pubkey, meaningfulScript);
}