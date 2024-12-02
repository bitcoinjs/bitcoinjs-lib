import { TinySecp256k1Interface } from './types';
/**
 * Initializes the ECC library with the provided instance.
 * If `eccLib` is `undefined`, the library will be cleared.
 * If `eccLib` is a new instance, it will be verified before setting it as the active library.
 *
 * @param eccLib The instance of the ECC library to initialize.
 * @param opts Extra initialization options. Use {DANGER_DO_NOT_VERIFY_ECCLIB:true} if ecc verification should not be executed. Not recommended!
 */
export declare function initEccLib(eccLib: TinySecp256k1Interface | undefined, opts?: {
    DANGER_DO_NOT_VERIFY_ECCLIB: boolean;
}): void;
/**
 * Retrieves the ECC Library instance.
 * Throws an error if the ECC Library is not provided.
 * You must call initEccLib() with a valid TinySecp256k1Interface instance before calling this function.
 * @returns The ECC Library instance.
 * @throws Error if the ECC Library is not provided.
 */
export declare function getEccLib(): TinySecp256k1Interface;
