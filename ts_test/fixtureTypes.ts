// fixtures/core folder
export type CoreBase58EncodeDecode = [string[]];
export type CoreBase58KeysInvalid = [string[]];
export interface CoreBase58Attributes {
  isPrivkey: boolean;
  isTestnet: boolean;
  isCompressed?: boolean;
  addrType?: string;
}
export type CoreBase58KeysValid = [Array<string | CoreBase58Attributes>];
export type CoreBlocks = [
  {
    id: string;
    transactions: number;
    hex: string;
  }
];
export type CoreSigCanonical = string[];
export type CoreSigNonCanonical = string[];
export type CoreSigHash = [Array<string | number>];
export type CoreTxValid = [string[] | Array<string | [Array<string | number>]>];

// fixtures folder
export interface FixtureAddress {
  standard: Array<{
    network: string;
    version: number;
    script: string;
    hash?: string;
    base58check?: string;
    bech32?: string;
    data?: string;
  }>;
  bech32: Array<{
    bech32: string;
    address: string;
    version: number;
    prefix: string;
    data: string;
  }>;
  invalid: {
    bech32: Array<{
      version: number;
      prefix: string;
      data: string;
      bech32: string;
      address: string;
      exception: string;
    }>;
    fromBase58Check: Array<{
      address: string;
      exception: string;
    }>;
    fromOutputScript: Array<{
      exception: string;
      script: string;
    }>;
    toOutputScript: Array<{
      exception: string;
      address: string;
      network?: {
        bech32: string;
      };
    }>;
  };
}
export interface FixtureBlock {
  targets: Array<{
    bits: string;
    expected: string;
  }>;
  valid: Array<{
    description: string;
    bits: number;
    hash: string;
    hex: string;
    id: string;
    merkleRoot: string;
    nonce: number;
    prevHash: string;
    timestamp: number;
    valid: boolean;
    version: number;
    height?: number;
    witnessCommit?: string;
  }>;
  invalid: Array<{
    exception: string;
    hex: string;
  }>;
}
export interface FixtureBufferUtils {
  valid: Array<{
    dec: number;
    hex: string;
  }>;
  invalid: {
    readUInt64LE: Array<{
      description: string;
      exception: string;
      hex: string;
      dec: number;
    }>;
  };
}
export type FixtureCrypto = Array<{
  hex: string;
  hash160: string;
  hash256: string;
  ripemd160: string;
  sha1: string;
  sha256: string;
}>;
export interface FixtureEcdsa {
  valid: {
    ecdsa: Array<{
      d: string;
      k: string;
      message: string;
      signature: {
        r: string;
        s: string;
      };
    }>;
    rfc6979: Array<{
      message: string;
      d: string;
      k0: string;
      k1: string;
      k15: string;
    }>;
  };
  invalid: {
    verify: Array<{
      description: string;
      d: string;
      message: string;
      signature: {
        r: string;
        s: string;
      };
    }>;
  };
}
export interface FixtureECPair {
  valid: Array<{
    d: string;
    Q: string;
    compressed: boolean;
    network: string;
    address: string;
    WIF: string;
  }>;
  invalid: {
    fromPrivateKey: Array<{
      exception: string;
      d: string;
      options?: {
        network?: {};
        compressed?: number;
      };
    }>;
    fromPublicKey: Array<{
      exception: string;
      Q: string;
      options: {
        network?: {};
      };
      description?: string;
    }>;
    fromWIF: Array<{
      exception: string;
      WIF: string;
      network?: string;
    }>;
  };
}
export interface FixtureEmbed {
  valid: Array<{
    description: string;
    arguments: {
      output?: string;
      data?: string[];
    };
    options?: {};
    expected: {
      output: string;
      data: string[];
      input: null;
      witness: null;
    };
  }>;
  invalid: Array<{
    exception: string;
    arguments: {
      output?: string;
    };
    description?: string;
    options?: {};
  }>;
  dynamic: {
    depends: {
      data: string[];
      output: string[];
    };
    details: Array<{
      description: string;
      data: string[];
      output: string;
    }>;
  };
}

export type FixtureScriptNumber = [
  {
    hex: string;
    number: number;
    bytes?: number;
  }
];
export interface FixtureScript {
  valid: Array<{
    asm: string;
    type?: string;
    script: string;
    stack?: string[];
    nonstandard?: {
      scriptSig: string;
      scriptSigHex: string;
    };
  }>;
  invalid: {
    decompile: Array<{
      description: string;
      script: string;
    }>;
    fromASM: Array<{
      description: string;
      script: string;
    }>;
  };
}
export interface FixtureSignatureRawSig {
  r: string;
  s: string;
}
export interface FixtureSignature {
  valid: Array<{
    hex: string;
    hashType: number;
    raw: FixtureSignatureRawSig;
  }>;
  invalid: Array<{
    exception: string;
    hex: string;
    hashType?: number;
    raw?: FixtureSignatureRawSig;
  }>;
}
export interface FixtureTemplateInput {
  description?: string;
  input?: string;
  inputHex?: string;
  output?: string;
  signatures?: string[];
  exception?: string;
  type?: string;
}
export interface FixtureTemplateOutput {
  exception?: string;
  commitment?: string;
  description?: string;
  scriptPubKeyHex?: string;
  outputHex?: string;
  hash?: string;
  m?: number;
  output?: string;
  pubKeys?: string[];
  signatures?: string[];
}
export interface FixtureTemplates {
  valid: Array<{
    type: string;
    typeIncomplete?: string;
    pubKey?: string;
    pubKeys?: string[];
    data?: string[];
    witnessScript?: string;
    witnessData?: string[];
    signature?: string;
    signatures?: Array<string | null>;
    redeemScript?: string;
    redeemScriptSig?: string;
    input?: string;
    inputHex?: string;
    output?: string;
    outputHex?: string;
    inputStack?: string[];
    nonstandard?: {
      input: string;
      inputHex: string;
    };
  }>;
  invalid: {
    pubKey: {
      inputs: FixtureTemplateInput[];
      outputs: FixtureTemplateOutput[];
    };
    pubKeyHash: {
      inputs: FixtureTemplateInput[];
      outputs: FixtureTemplateOutput[];
    };
    scriptHash: {
      inputs: FixtureTemplateInput[];
      outputs: FixtureTemplateOutput[];
    };
    multisig: {
      inputs: FixtureTemplateInput[];
      outputs: FixtureTemplateOutput[];
    };
    witnessPubKeyHash: {
      inputs: [];
      outputs: FixtureTemplateOutput[];
    };
    witnessScriptHash: {
      inputs: [];
      outputs: FixtureTemplateOutput[];
    };
    witnessCommitment: {
      inputs: [];
      outputs: FixtureTemplateOutput[];
    };
  };
}
export interface FixtureTransactionBuilderValidBuild {
  description: string;
  exception?: string;
  txHex: string;
  txHexAfter?: string;
  version?: number | null;
  locktime?: number;
  network?: string;
  incomplete?: boolean;
  stages?: string[];
  outputs: Array<{
    script: string;
    value: number;
  }>;
  inputs: Array<{
    vout: number;
    txHex?: string;
    txId?: string;
    sequence?: number;
    scriptSig?: string;
    scriptSigAfter?: string;
    prevTxScript?: string;
    signs: Array<{
      keyPair: string;
      throws?: boolean;
      stage?: string;
      value?: number;
      witnessScript?: string;
      redeemScript?: string;
      network?: string;
      hashType?: number;
    }>;
  }>;
}
export interface FixtureTransactionBuilder {
  valid: {
    build: FixtureTransactionBuilderValidBuild[];
    fromTransaction: Array<{
      description: string;
      network: string;
      incomplete?: boolean;
      outputs: Array<{
        script: string;
        value: number;
      }>;
      inputs: Array<{
        vout: number;
        txHex?: string;
        txId?: string;
        prevTxScript?: string;
        scriptSig?: string;
        scriptSigAfter?: string;
        signs: Array<{
          keyPair: string;
          throws?: boolean;
          value?: number;
          witnessScript?: string;
          redeemScript?: string;
          network?: string;
          hashType?: number;
        }>;
      }>;
    }>;
    fromTransactionSequential: FixtureTransactionBuilderValidBuild[];
    classification: {
      hex: string;
    };
    multisig: Array<{
      description: string;
      network: string;
      txHex: string;
      version: number;
      outputs: Array<{
        script: string;
        value: number;
      }>;
      inputs: Array<{
        vout: number;
        txHex?: string;
        txId?: string;
        redeemScript?: string;
        prevTxScript?: string;
        signs: Array<{
          keyPair: string;
          throws?: boolean;
          value?: number;
          witnessScript?: string;
          redeemScript?: string;
          scriptSigBefore?: string;
          scriptSig?: string;
          network?: string;
          hashType?: number;
        }>;
      }>;
    }>;
  };
  invalid: {
    build: FixtureTransactionBuilderValidBuild[];
    sign: FixtureTransactionBuilderValidBuild[];
    fromTransaction: Array<{
      exception: string;
      txHex: string;
    }>;
  };
}
export interface FixtureTransactionRaw {
  version: number;
  ins: Array<{
    hash: string;
    index: number;
    data: string;
    script: string;
    sequence: number;
    witness: string[];
  }>;
  outs: Array<{
    script: string;
    data: string;
    value: number;
  }>;
  locktime: number;
}
export interface FixtureTransactionValid {
  description: string;
  id: string;
  hash: string;
  txHex: string;
  script: string;
  inIndex: number;
  type: number;
  value: number;
  hex: string;
  whex: string;
  raw: FixtureTransactionRaw;
  coinbase: boolean;
  virtualSize: number;
  weight: number;
}
export interface FixtureTransaction {
  valid: FixtureTransactionValid[];
  hashForSignature: FixtureTransactionValid[];
  hashForWitnessV0: FixtureTransactionValid[];
  invalid: {
    addInput: Array<{
      exception: string;
      hash: string;
      index: number;
    }>;
    fromBuffer: Array<{
      exception: string;
      hex: string;
    }>;
  };
}

// aa
