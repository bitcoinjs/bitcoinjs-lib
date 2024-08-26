export declare function check(buffer: Uint8Array): boolean;
export declare function decode(buffer: Uint8Array): {
    r: Uint8Array;
    s: Uint8Array;
};
export declare function encode(r: Uint8Array, s: Uint8Array): Uint8Array;
