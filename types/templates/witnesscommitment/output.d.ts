export declare function check(script: Buffer | Array<number | Buffer>): boolean;
export declare namespace check {
    var toJSON: () => string;
}
export declare function encode(commitment: Buffer): Buffer;
export declare function decode(buffer: Buffer): Buffer;
