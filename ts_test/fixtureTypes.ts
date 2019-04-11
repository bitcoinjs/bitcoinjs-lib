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
export interface FixtureSignature {
  valid: Array<{
    hex: string;
    hashType: number;
    raw: {
      r: string;
      s: string;
    };
  }>;
  invalid: Array<{
    exception: string;
    hex: string;
    hashType?: number;
    raw?: {
      r: string;
      s: string;
    };
  }>;
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
      inputs: Array<{
        description: string;
        input: string;
      }>;
      outputs: Array<{
        description: string;
        outputHex?: string;
        output?: string;
      }>;
    };
    pubKeyHash: {
      inputs: Array<{
        description: string;
        input: string;
      }>;
      outputs: Array<{
        description?: string;
        outputHex?: string;
        exception?: string;
        hash?: string;
      }>;
    };
    scriptHash: {
      inputs: Array<{
        description: string;
        input: string;
      }>;
      outputs: Array<{
        description?: string;
        outputHex?: string;
        exception?: string;
        hash?: string;
      }>;
    };
    multisig: {
      inputs: Array<{
        output: string;
        signatures: string[];
        exception?: string;
        description?: string;
        type?: string;
      }>;
      outputs: Array<{
        description?: string;
        output?: string;
        exception?: string;
        m?: number;
        pubKeys?: string[];
        signatures?: string[];
      }>;
    };
    witnessPubKeyHash: {
      inputs: [];
      outputs: Array<{
        description?: string;
        outputHex?: string;
        exception?: string;
        hash?: string;
      }>;
    };
    witnessScriptHash: {
      inputs: [];
      outputs: Array<{
        description?: string;
        outputHex?: string;
        exception?: string;
        hash?: string;
      }>;
    };
    witnessCommitment: {
      inputs: [];
      outputs: Array<{
        exception?: string;
        commitment?: string;
        description?: string;
        scriptPubKeyHex?: string;
      }>;
    };
  };
}
export interface FixtureTransactionBuilder {
  valid: {
    build: Array<{
      description: string;
      txHex: string;
      version?: number | null;
      locktime?: number;
      network?: string;
      incomplete?: boolean;
      outputs: Array<{
        script: string;
        value: number;
      }>;
      inputs: Array<{
        vout: number;
        txHex?: string;
        txId?: string;
        sequence?: number;
        prevTxScript?: string;
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
    fromTransactionSequential: Array<{
      description: string;
      network: string;
      txHex: string;
      txHexAfter: string;
      version: number;
      incomplete: boolean;
      inputs: Array<{
        vout: number;
        scriptSig: string;
        scriptSigAfter: string;
        signs: Array<{
          keyPair: string;
          redeemScript?: string;
        }>;
      }>;
    }>;
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
        prevTxScript?: string;
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
  };
  invalid: {
    build: Array<{
      exception: string;
      description?: string;
      network?: string;
      incomplete?: boolean;
      txHex?: string;
      outputs?: Array<{
        script: string;
        value: number;
      }>;
      inputs?: Array<{
        vout: number;
        txHex?: string;
        txId?: string;
        prevTxScript?: string;
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
    sign: Array<{
      description?: string;
      network?: string;
      exception: string;
      inputs: Array<{
        vout: number;
        txHex?: string;
        txId?: string;
        prevTxScript?: string;
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
      outputs: Array<{
        script: string;
        value: number;
      }>;
    }>;
    fromTransaction: Array<{
      exception: string;
      txHex: string;
    }>;
  };
}

// aa
