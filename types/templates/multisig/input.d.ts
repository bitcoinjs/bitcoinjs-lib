import { Stack } from '../../payments';
export declare function check(script: Buffer | Stack, allowIncomplete?: boolean): boolean;
export declare namespace check {
    var toJSON: () => string;
}
