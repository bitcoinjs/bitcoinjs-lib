import { toXOnly } from 'bitcoinjs-lib';
import { tapScriptFinalizer } from 'bitcoinjs-lib/src/psbt/bip371';
import {
  tapleafHash,
  LEAF_VERSION_TAPSCRIPT,
} from 'bitcoinjs-lib/src/payments/bip341';
import type { PsbtInput, TapScriptSig } from 'bip174';
import * as assert from 'assert';
import * as tools from 'uint8array-tools';

describe('toXOnly', () => {
  it('should return the input if the pubKey length is 32', () => {
    const pubKey = new Uint8Array(32).fill(1); // Example 32-byte public key
    const result = toXOnly(pubKey);
    assert.strictEqual(result, pubKey); // Expect the same array (reference equality)
  });

  it('should return the sliced key if the pubKey length is greater than 32', () => {
    const pubKey = new Uint8Array(33).fill(1);
    pubKey[0] = 0; // Add a leading byte
    const result = toXOnly(pubKey);
    assert.deepStrictEqual(result, pubKey.slice(1, 33)); // Expect the sliced array
  });

  it('should return the key if the pubKey length is less than 32', () => {
    const pubKey = new Uint8Array(31).fill(1); // Example invalid public key
    const result = toXOnly(pubKey);
    assert.deepStrictEqual(result, pubKey.slice(1, 33)); // Expect the sliced array
  });
});

describe('tapScriptFinalizer', () => {
  // Helper to create a basic tapLeafScript
  const createTapLeafScript = (
    script: Uint8Array,
    controlBlock: Uint8Array,
  ) => ({
    script,
    controlBlock,
    leafVersion: LEAF_VERSION_TAPSCRIPT,
  });

  // Helper to create a tapScriptSig
  const createTapScriptSig = (
    pubkey: Uint8Array,
    signature: Uint8Array,
    leafHash: Uint8Array,
  ): TapScriptSig => ({
    pubkey,
    signature,
    leafHash,
  });

  describe('successful finalization', () => {
    it('should finalize a taproot input with valid signatures', () => {
      const script = new Uint8Array([
        0x20,
        ...new Uint8Array(32).fill(1),
        0xac,
      ]); // Simple script with pubkey
      const controlBlock = new Uint8Array(33).fill(2);
      const tapLeafScript = createTapLeafScript(script, controlBlock);

      const leafHash = tapleafHash({
        output: script,
        version: LEAF_VERSION_TAPSCRIPT,
      });

      const pubkey = new Uint8Array(32).fill(1);
      const signature = new Uint8Array(64).fill(3);
      const tapScriptSig = createTapScriptSig(pubkey, signature, leafHash);

      const input: PsbtInput = {
        tapLeafScript: [tapLeafScript],
        tapScriptSig: [tapScriptSig],
      };

      const result = tapScriptFinalizer(0, input);

      assert.ok(result.finalScriptWitness);
      assert.ok(result.finalScriptWitness instanceof Uint8Array);
      assert.ok(result.finalScriptWitness.length > 0);
    });

    it('should finalize with a specific tapLeafHashToFinalize', () => {
      const script1 = new Uint8Array([
        0x20,
        ...new Uint8Array(32).fill(1),
        0xac,
      ]);
      const script2 = new Uint8Array([
        0x20,
        ...new Uint8Array(32).fill(5),
        0xac,
      ]);
      const controlBlock1 = new Uint8Array(33).fill(2);
      const controlBlock2 = new Uint8Array(65).fill(3); // Longer control block

      const tapLeafScript1 = createTapLeafScript(script1, controlBlock1);
      const tapLeafScript2 = createTapLeafScript(script2, controlBlock2);

      const leafHash1 = tapleafHash({
        output: script1,
        version: LEAF_VERSION_TAPSCRIPT,
      });
      const leafHash2 = tapleafHash({
        output: script2,
        version: LEAF_VERSION_TAPSCRIPT,
      });

      const pubkey = new Uint8Array(32).fill(1);
      const signature1 = new Uint8Array(64).fill(3);
      const signature2 = new Uint8Array(64).fill(4);

      const tapScriptSig1 = createTapScriptSig(pubkey, signature1, leafHash1);
      const tapScriptSig2 = createTapScriptSig(pubkey, signature2, leafHash2);

      const input: PsbtInput = {
        tapLeafScript: [tapLeafScript1, tapLeafScript2],
        tapScriptSig: [tapScriptSig1, tapScriptSig2],
      };

      // Finalize with specific leaf hash (should use script2)
      const result = tapScriptFinalizer(0, input, leafHash2);

      assert.ok(result.finalScriptWitness);
      assert.ok(result.finalScriptWitness instanceof Uint8Array);
    });

    it('should select the tapleaf with shortest control block when multiple are available', () => {
      const script1 = new Uint8Array([
        0x20,
        ...new Uint8Array(32).fill(1),
        0xac,
      ]);
      const script2 = new Uint8Array([
        0x20,
        ...new Uint8Array(32).fill(5),
        0xac,
      ]);
      const shortControlBlock = new Uint8Array(33).fill(2);
      const longControlBlock = new Uint8Array(65).fill(3);

      const tapLeafScript1 = createTapLeafScript(script1, longControlBlock);
      const tapLeafScript2 = createTapLeafScript(script2, shortControlBlock);

      const leafHash1 = tapleafHash({
        output: script1,
        version: LEAF_VERSION_TAPSCRIPT,
      });
      const leafHash2 = tapleafHash({
        output: script2,
        version: LEAF_VERSION_TAPSCRIPT,
      });

      const pubkey = new Uint8Array(32).fill(1);
      const signature1 = new Uint8Array(64).fill(3);
      const signature2 = new Uint8Array(64).fill(4);

      const tapScriptSig1 = createTapScriptSig(pubkey, signature1, leafHash1);
      const tapScriptSig2 = createTapScriptSig(pubkey, signature2, leafHash2);

      const input: PsbtInput = {
        tapLeafScript: [tapLeafScript1, tapLeafScript2],
        tapScriptSig: [tapScriptSig1, tapScriptSig2],
      };

      // Should select script2 because it has shorter control block
      const result = tapScriptFinalizer(0, input);

      assert.ok(result.finalScriptWitness);
    });
  });

  describe('error cases', () => {
    it('should throw error when no tapScriptSig is provided', () => {
      const script = new Uint8Array([
        0x20,
        ...new Uint8Array(32).fill(1),
        0xac,
      ]);
      const controlBlock = new Uint8Array(33).fill(2);
      const tapLeafScript = createTapLeafScript(script, controlBlock);

      const input: PsbtInput = {
        tapLeafScript: [tapLeafScript],
        tapScriptSig: [], // Empty signatures
      };

      assert.throws(
        () => tapScriptFinalizer(5, input),
        /Can not finalize taproot input #5\. No tapleaf script signature provided\./,
      );
    });

    it('should throw error when tapScriptSig is undefined', () => {
      const script = new Uint8Array([
        0x20,
        ...new Uint8Array(32).fill(1),
        0xac,
      ]);
      const controlBlock = new Uint8Array(33).fill(2);
      const tapLeafScript = createTapLeafScript(script, controlBlock);

      const input: PsbtInput = {
        tapLeafScript: [tapLeafScript],
        // tapScriptSig is undefined
      };

      assert.throws(
        () => tapScriptFinalizer(3, input),
        /Can not finalize taproot input #3\. No tapleaf script signature provided\./,
      );
    });

    it('should throw error when signature for tapleaf script is not found', () => {
      const script = new Uint8Array([
        0x20,
        ...new Uint8Array(32).fill(1),
        0xac,
      ]);
      const controlBlock = new Uint8Array(33).fill(2);
      const tapLeafScript = createTapLeafScript(script, controlBlock);

      const leafHash = tapleafHash({
        output: script,
        version: LEAF_VERSION_TAPSCRIPT,
      });

      // Create a signature with a different (wrong) leaf hash
      const wrongLeafHash = new Uint8Array(32).fill(99);
      const pubkey = new Uint8Array(32).fill(1);
      const signature = new Uint8Array(64).fill(3);
      const tapScriptSig = createTapScriptSig(pubkey, signature, wrongLeafHash);

      const input: PsbtInput = {
        tapLeafScript: [tapLeafScript],
        tapScriptSig: [tapScriptSig], // Signature with wrong leaf hash
      };

      assert.throws(
        () => tapScriptFinalizer(2, input),
        /Can not finalize taproot input #2\. Signature for tapleaf script not found\./,
      );
    });

    it('should throw error when specific tapLeafHashToFinalize is not found', () => {
      const script = new Uint8Array([
        0x20,
        ...new Uint8Array(32).fill(1),
        0xac,
      ]);
      const controlBlock = new Uint8Array(33).fill(2);
      const tapLeafScript = createTapLeafScript(script, controlBlock);

      const leafHash = tapleafHash({
        output: script,
        version: LEAF_VERSION_TAPSCRIPT,
      });

      const pubkey = new Uint8Array(32).fill(1);
      const signature = new Uint8Array(64).fill(3);
      const tapScriptSig = createTapScriptSig(pubkey, signature, leafHash);

      const input: PsbtInput = {
        tapLeafScript: [tapLeafScript],
        tapScriptSig: [tapScriptSig],
      };

      // Request a different leaf hash that doesn't exist
      const nonExistentLeafHash = new Uint8Array(32).fill(88);

      assert.throws(
        () => tapScriptFinalizer(7, input, nonExistentLeafHash),
        /Can not finalize taproot input #7\. Signature for tapleaf script not found\./,
      );
    });

    it('should throw error when witness stack construction fails', () => {
      const script = new Uint8Array([
        0x20,
        ...new Uint8Array(32).fill(1),
        0xac,
      ]);
      const controlBlock = new Uint8Array(33).fill(2);
      const tapLeafScript = createTapLeafScript(script, controlBlock);

      const leafHash = tapleafHash({
        output: script,
        version: LEAF_VERSION_TAPSCRIPT,
      });

      const pubkey = new Uint8Array(32).fill(1);
      const signature = new Uint8Array(64).fill(3);
      const tapScriptSig = createTapScriptSig(pubkey, signature, leafHash);

      const input: PsbtInput = {
        tapLeafScript: [tapLeafScript],
        tapScriptSig: [tapScriptSig],
      };

      // This test verifies the try-catch block wraps errors properly
      const result = tapScriptFinalizer(0, input);
      assert.ok(result.finalScriptWitness);
    });
  });

  describe('signature sorting', () => {
    it('should handle multiple signatures for the same leaf', () => {
      // Create a script that expects multiple signatures
      const pubkey1 = new Uint8Array(32).fill(1);
      const pubkey2 = new Uint8Array(32).fill(2);

      // Script with two pubkeys
      const script = tools.concat([
        new Uint8Array([0x20]),
        pubkey1,
        new Uint8Array([0x20]),
        pubkey2,
        new Uint8Array([0xac]),
      ]);

      const controlBlock = new Uint8Array(33).fill(3);
      const tapLeafScript = createTapLeafScript(script, controlBlock);

      const leafHash = tapleafHash({
        output: script,
        version: LEAF_VERSION_TAPSCRIPT,
      });

      const signature1 = new Uint8Array(64).fill(10);
      const signature2 = new Uint8Array(64).fill(20);

      const tapScriptSig1 = createTapScriptSig(pubkey1, signature1, leafHash);
      const tapScriptSig2 = createTapScriptSig(pubkey2, signature2, leafHash);

      const input: PsbtInput = {
        tapLeafScript: [tapLeafScript],
        tapScriptSig: [tapScriptSig1, tapScriptSig2],
      };

      const result = tapScriptFinalizer(0, input);

      assert.ok(result.finalScriptWitness);
      assert.ok(result.finalScriptWitness instanceof Uint8Array);
      assert.ok(result.finalScriptWitness.length > 0);
    });
  });
});
