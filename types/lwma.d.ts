import { BlockGold as Block } from './block_gold';
export interface LwmaConfig {
    enableHeight: number;
    testnet: boolean;
    regtest: boolean;
    powTargetSpacing: number;
    averagingWindow: number;
    adjustWeight: number;
    minDenominator: number;
    solveTimeLimitation: boolean;
    powLimit: string;
}
export declare function calcNextBits(currentBlock: Block, previousBlocks: Block[], lwmaConfig: LwmaConfig): number;
