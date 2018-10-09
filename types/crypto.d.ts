/** 
 * These types were originally written by 
 * Mohamed Hegazy https://github.com/mhegazy,
 * Daniel https://github.com/dlebrecht, 
 * Ron Buckton https://github.com/rbuckton, 
 * Satana Charuwichitratana https://github.com/micksatana, 
 * Youssef GHOUBACH https://github.com/youssefgh, 
 * Kento https://github.com/kento1218.
 */

export namespace crypto {
  function hash160(buffer: Buffer): Buffer

  function hash256(buffer: Buffer): Buffer

  function ripemd160(buffer: Buffer): Buffer

  function sha1(buffer: Buffer): Buffer

  function sha256(buffer: Buffer): Buffer
}
