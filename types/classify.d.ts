declare const types: {
    P2MS: string;
    NONSTANDARD: string;
    NULLDATA: string;
    P2PK: string;
    P2PKH: string;
    P2SH: string;
    P2WPKH: string;
    P2WSH: string;
    WITNESS_COMMITMENT: string;
};
declare function classifyOutput(script: Buffer): string;
declare function classifyInput(script: Buffer, allowIncomplete?: boolean): string;
declare function classifyWitness(script: Buffer[], allowIncomplete?: boolean): string;
export { classifyInput as input, classifyOutput as output, classifyWitness as witness, types, };
