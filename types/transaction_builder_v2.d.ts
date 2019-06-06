import { Network } from './networks';
import { TransactionBuilder } from './transaction_builder';
export declare class TransactionBuilderV2 extends TransactionBuilder {
    network: Network;
    maximumFeeRate: number;
    static fromPsbtString(psbtString: string, network?: Network): TransactionBuilder;
    constructor(network?: Network, maximumFeeRate?: number);
}
