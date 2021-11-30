import * as assert from 'assert';
import { describe, it } from 'mocha';
import * as bufferutils from '../src/bufferutils';
import { BufferReader, BufferWriter } from '../src/bufferutils';

import * as fixtures from './fixtures/bufferutils.json';
const varuint = require('varuint-bitcoin');

describe('bufferutils', () => {
  function concatToBuffer(values: number[][]): Buffer {
    return Buffer.concat(values.map(data => Buffer.from(data)));
  }

  describe('readUInt64LE', () => {
    fixtures.valid.forEach(f => {
      it('decodes ' + f.hex, () => {
        const buffer = Buffer.from(f.hex, 'hex');
        const num = bufferutils.readUInt64LE(buffer, 0);

        assert.strictEqual(num, f.dec);
      });
    });

    fixtures.invalid.readUInt64LE.forEach(f => {
      it('throws on ' + f.description, () => {
        const buffer = Buffer.from(f.hex, 'hex');

        assert.throws(() => {
          bufferutils.readUInt64LE(buffer, 0);
        }, new RegExp(f.exception));
      });
    });
  });

  describe('writeUInt64LE', () => {
    fixtures.valid.forEach(f => {
      it('encodes ' + f.dec, () => {
        const buffer = Buffer.alloc(8, 0);

        bufferutils.writeUInt64LE(buffer, f.dec, 0);
        assert.strictEqual(buffer.toString('hex'), f.hex);
      });
    });

    fixtures.invalid.writeUInt64LE.forEach(f => {
      it('throws on ' + f.description, () => {
        const buffer = Buffer.alloc(8, 0);

        assert.throws(() => {
          bufferutils.writeUInt64LE(buffer, f.dec, 0);
        }, new RegExp(f.exception));
      });
    });
  });

  describe('BufferWriter', () => {
    function testBuffer(
      bufferWriter: BufferWriter,
      expectedBuffer: Buffer,
      expectedOffset: number = expectedBuffer.length,
    ): void {
      assert.strictEqual(bufferWriter.offset, expectedOffset);
      assert.deepStrictEqual(
        bufferWriter.buffer.slice(0, expectedOffset),
        expectedBuffer.slice(0, expectedOffset),
      );
    }

    it('writeUint8', () => {
      const values = [0, 1, 254, 255];
      const expectedBuffer = Buffer.from([0, 1, 0xfe, 0xff]);
      const bufferWriter = new BufferWriter(
        Buffer.allocUnsafe(expectedBuffer.length),
      );
      values.forEach((v: number) => {
        const expectedOffset = bufferWriter.offset + 1;
        bufferWriter.writeUInt8(v);
        testBuffer(bufferWriter, expectedBuffer, expectedOffset);
      });
      testBuffer(bufferWriter, expectedBuffer);
    });

    it('writeInt32', () => {
      const values = [
        0,
        1,
        Math.pow(2, 31) - 2,
        Math.pow(2, 31) - 1,
        -1,
        -Math.pow(2, 31),
      ];
      const expectedBuffer = concatToBuffer([
        [0, 0, 0, 0],
        [1, 0, 0, 0],
        [0xfe, 0xff, 0xff, 0x7f],
        [0xff, 0xff, 0xff, 0x7f],
        [0xff, 0xff, 0xff, 0xff],
        [0x00, 0x00, 0x00, 0x80],
      ]);
      const bufferWriter = new BufferWriter(
        Buffer.allocUnsafe(expectedBuffer.length),
      );
      values.forEach((value: number) => {
        const expectedOffset = bufferWriter.offset + 4;
        bufferWriter.writeInt32(value);
        testBuffer(bufferWriter, expectedBuffer, expectedOffset);
      });
      testBuffer(bufferWriter, expectedBuffer);
    });

    it('writeUInt32', () => {
      const maxUInt32 = Math.pow(2, 32) - 1;
      const values = [0, 1, Math.pow(2, 16), maxUInt32];
      const expectedBuffer = concatToBuffer([
        [0, 0, 0, 0],
        [1, 0, 0, 0],
        [0, 0, 1, 0],
        [0xff, 0xff, 0xff, 0xff],
      ]);
      const bufferWriter = new BufferWriter(
        Buffer.allocUnsafe(expectedBuffer.length),
      );
      values.forEach((value: number) => {
        const expectedOffset = bufferWriter.offset + 4;
        bufferWriter.writeUInt32(value);
        testBuffer(bufferWriter, expectedBuffer, expectedOffset);
      });
      testBuffer(bufferWriter, expectedBuffer);
    });

    it('writeUInt64', () => {
      const values = [
        0,
        1,
        Math.pow(2, 32),
        Number.MAX_SAFE_INTEGER /* 2^53 - 1 */,
      ];
      const expectedBuffer = concatToBuffer([
        [0, 0, 0, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 1, 0, 0, 0],
        [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x1f, 0x00],
      ]);
      const bufferWriter = new BufferWriter(
        Buffer.allocUnsafe(expectedBuffer.length),
      );
      values.forEach((value: number) => {
        const expectedOffset = bufferWriter.offset + 8;
        bufferWriter.writeUInt64(value);
        testBuffer(bufferWriter, expectedBuffer, expectedOffset);
      });
      testBuffer(bufferWriter, expectedBuffer);
    });

    it('writeVarInt', () => {
      const values = [
        0,
        1,
        252,
        253,
        254,
        255,
        256,
        Math.pow(2, 16) - 2,
        Math.pow(2, 16) - 1,
        Math.pow(2, 16),
        Math.pow(2, 32) - 2,
        Math.pow(2, 32) - 1,
        Math.pow(2, 32),
        Number.MAX_SAFE_INTEGER,
      ];
      const expectedBuffer = concatToBuffer([
        [0x00],
        [0x01],
        [0xfc],
        [0xfd, 0xfd, 0x00],
        [0xfd, 0xfe, 0x00],
        [0xfd, 0xff, 0x00],
        [0xfd, 0x00, 0x01],
        [0xfd, 0xfe, 0xff],
        [0xfd, 0xff, 0xff],
        [0xfe, 0x00, 0x00, 0x01, 0x00],
        [0xfe, 0xfe, 0xff, 0xff, 0xff],
        [0xfe, 0xff, 0xff, 0xff, 0xff],
        [0xff, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00],
        [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x1f, 0x00],
      ]);
      const bufferWriter = new BufferWriter(
        Buffer.allocUnsafe(expectedBuffer.length),
      );
      values.forEach((value: number) => {
        const expectedOffset =
          bufferWriter.offset + varuint.encodingLength(value);
        bufferWriter.writeVarInt(value);
        testBuffer(bufferWriter, expectedBuffer, expectedOffset);
      });
      testBuffer(bufferWriter, expectedBuffer);
    });

    it('writeSlice', () => {
      const values = [[], [1], [1, 2, 3, 4], [254, 255]];
      const expectedBuffer = concatToBuffer(values);
      const bufferWriter = new BufferWriter(
        Buffer.allocUnsafe(expectedBuffer.length),
      );
      values.forEach((v: number[]) => {
        const expectedOffset = bufferWriter.offset + v.length;
        bufferWriter.writeSlice(Buffer.from(v));
        testBuffer(bufferWriter, expectedBuffer, expectedOffset);
      });
      testBuffer(bufferWriter, expectedBuffer);
      assert.throws(() => {
        bufferWriter.writeSlice(Buffer.from([0, 0]));
      }, /^Error: Cannot write slice out of bounds$/);
    });

    it('writeVarSlice', () => {
      const values = [
        Buffer.alloc(1, 1),
        Buffer.alloc(252, 2),
        Buffer.alloc(253, 3),
      ];
      const expectedBuffer = Buffer.concat([
        Buffer.from([0x01, 0x01]),
        Buffer.from([0xfc]),
        Buffer.alloc(252, 0x02),
        Buffer.from([0xfd, 0xfd, 0x00]),
        Buffer.alloc(253, 0x03),
      ]);
      const bufferWriter = new BufferWriter(
        Buffer.allocUnsafe(expectedBuffer.length),
      );
      values.forEach((value: Buffer) => {
        const expectedOffset =
          bufferWriter.offset +
          varuint.encodingLength(value.length) +
          value.length;
        bufferWriter.writeVarSlice(value);
        testBuffer(bufferWriter, expectedBuffer, expectedOffset);
      });
      testBuffer(bufferWriter, expectedBuffer);
    });

    it('writeVector', () => {
      const values = [
        [Buffer.alloc(1, 4), Buffer.alloc(253, 5)],
        Array(253).fill(Buffer.alloc(1, 6)),
      ];
      const expectedBuffer = Buffer.concat([
        Buffer.from([0x02]),
        Buffer.from([0x01, 0x04]),
        Buffer.from([0xfd, 0xfd, 0x00]),
        Buffer.alloc(253, 5),

        Buffer.from([0xfd, 0xfd, 0x00]),
        Buffer.concat(
          Array(253)
            .fill(0)
            .map(() => Buffer.from([0x01, 0x06])),
        ),
      ]);

      const bufferWriter = new BufferWriter(
        Buffer.allocUnsafe(expectedBuffer.length),
      );
      values.forEach((value: Buffer[]) => {
        const expectedOffset =
          bufferWriter.offset +
          varuint.encodingLength(value.length) +
          value.reduce(
            (sum: number, v) =>
              sum + varuint.encodingLength(v.length) + v.length,
            0,
          );
        bufferWriter.writeVector(value);
        testBuffer(bufferWriter, expectedBuffer, expectedOffset);
      });
      testBuffer(bufferWriter, expectedBuffer);
    });
  });

  describe('BufferReader', () => {
    function testValue(
      bufferReader: BufferReader,
      value: Buffer | number,
      expectedValue: Buffer | number,
      expectedOffset: number = Buffer.isBuffer(expectedValue)
        ? expectedValue.length
        : 0,
    ): void {
      assert.strictEqual(bufferReader.offset, expectedOffset);
      if (Buffer.isBuffer(expectedValue)) {
        assert.deepStrictEqual(
          (value as Buffer).slice(0, expectedOffset),
          expectedValue.slice(0, expectedOffset),
        );
      } else {
        assert.strictEqual(value as number, expectedValue);
      }
    }

    it('readUint8', () => {
      const values = [0, 1, 0xfe, 0xff];
      const buffer = Buffer.from([0, 1, 0xfe, 0xff]);
      const bufferReader = new BufferReader(buffer);
      values.forEach((v: number) => {
        const expectedOffset = bufferReader.offset + 1;
        const val = bufferReader.readUInt8();
        testValue(bufferReader, val, v, expectedOffset);
      });
    });

    it('readInt32', () => {
      const values = [
        0,
        1,
        Math.pow(2, 31) - 2,
        Math.pow(2, 31) - 1,
        -1,
        -Math.pow(2, 31),
      ];
      const buffer = concatToBuffer([
        [0, 0, 0, 0],
        [1, 0, 0, 0],
        [0xfe, 0xff, 0xff, 0x7f],
        [0xff, 0xff, 0xff, 0x7f],
        [0xff, 0xff, 0xff, 0xff],
        [0x00, 0x00, 0x00, 0x80],
      ]);
      const bufferReader = new BufferReader(buffer);
      values.forEach((value: number) => {
        const expectedOffset = bufferReader.offset + 4;
        const val = bufferReader.readInt32();
        testValue(bufferReader, val, value, expectedOffset);
      });
    });

    it('readUInt32', () => {
      const maxUInt32 = Math.pow(2, 32) - 1;
      const values = [0, 1, Math.pow(2, 16), maxUInt32];
      const buffer = concatToBuffer([
        [0, 0, 0, 0],
        [1, 0, 0, 0],
        [0, 0, 1, 0],
        [0xff, 0xff, 0xff, 0xff],
      ]);
      const bufferReader = new BufferReader(buffer);
      values.forEach((value: number) => {
        const expectedOffset = bufferReader.offset + 4;
        const val = bufferReader.readUInt32();
        testValue(bufferReader, val, value, expectedOffset);
      });
    });

    it('readUInt64', () => {
      const values = [
        0,
        1,
        Math.pow(2, 32),
        Number.MAX_SAFE_INTEGER /* 2^53 - 1 */,
      ];
      const buffer = concatToBuffer([
        [0, 0, 0, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 1, 0, 0, 0],
        [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x1f, 0x00],
      ]);
      const bufferReader = new BufferReader(buffer);
      values.forEach((value: number) => {
        const expectedOffset = bufferReader.offset + 8;
        const val = bufferReader.readUInt64();
        testValue(bufferReader, val, value, expectedOffset);
      });
    });

    it('readVarInt', () => {
      const values = [
        0,
        1,
        252,
        253,
        254,
        255,
        256,
        Math.pow(2, 16) - 2,
        Math.pow(2, 16) - 1,
        Math.pow(2, 16),
        Math.pow(2, 32) - 2,
        Math.pow(2, 32) - 1,
        Math.pow(2, 32),
        Number.MAX_SAFE_INTEGER,
      ];
      const buffer = concatToBuffer([
        [0x00],
        [0x01],
        [0xfc],
        [0xfd, 0xfd, 0x00],
        [0xfd, 0xfe, 0x00],
        [0xfd, 0xff, 0x00],
        [0xfd, 0x00, 0x01],
        [0xfd, 0xfe, 0xff],
        [0xfd, 0xff, 0xff],
        [0xfe, 0x00, 0x00, 0x01, 0x00],
        [0xfe, 0xfe, 0xff, 0xff, 0xff],
        [0xfe, 0xff, 0xff, 0xff, 0xff],
        [0xff, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00],
        [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x1f, 0x00],
      ]);
      const bufferReader = new BufferReader(buffer);
      values.forEach((value: number) => {
        const expectedOffset =
          bufferReader.offset + varuint.encodingLength(value);
        const val = bufferReader.readVarInt();
        testValue(bufferReader, val, value, expectedOffset);
      });
    });

    it('readSlice', () => {
      const values = [[1], [1, 2, 3, 4], [254, 255]];
      const buffer = concatToBuffer(values);
      const bufferReader = new BufferReader(buffer);
      values.forEach((v: number[]) => {
        const expectedOffset = bufferReader.offset + v.length;
        const val = bufferReader.readSlice(v.length);
        testValue(bufferReader, val, Buffer.from(v), expectedOffset);
      });
      assert.throws(() => {
        bufferReader.readSlice(2);
      }, /^Error: Cannot read slice out of bounds$/);
    });

    it('readVarSlice', () => {
      const values = [
        Buffer.alloc(1, 1),
        Buffer.alloc(252, 2),
        Buffer.alloc(253, 3),
      ];
      const buffer = Buffer.concat([
        Buffer.from([0x01, 0x01]),
        Buffer.from([0xfc]),
        Buffer.alloc(252, 0x02),
        Buffer.from([0xfd, 0xfd, 0x00]),
        Buffer.alloc(253, 0x03),
      ]);
      const bufferReader = new BufferReader(buffer);
      values.forEach((value: Buffer) => {
        const expectedOffset =
          bufferReader.offset +
          varuint.encodingLength(value.length) +
          value.length;
        const val = bufferReader.readVarSlice();
        testValue(bufferReader, val, value, expectedOffset);
      });
    });

    it('readVector', () => {
      const values = [
        [Buffer.alloc(1, 4), Buffer.alloc(253, 5)],
        Array(253).fill(Buffer.alloc(1, 6)),
      ];
      const buffer = Buffer.concat([
        Buffer.from([0x02]),
        Buffer.from([0x01, 0x04]),
        Buffer.from([0xfd, 0xfd, 0x00]),
        Buffer.alloc(253, 5),

        Buffer.from([0xfd, 0xfd, 0x00]),
        Buffer.concat(
          Array(253)
            .fill(0)
            .map(() => Buffer.from([0x01, 0x06])),
        ),
      ]);

      const bufferReader = new BufferReader(buffer);
      values.forEach((value: Buffer[]) => {
        const expectedOffset =
          bufferReader.offset +
          varuint.encodingLength(value.length) +
          value.reduce(
            (sum: number, v) =>
              sum + varuint.encodingLength(v.length) + v.length,
            0,
          );
        const val = bufferReader.readVector();
        testValue(
          bufferReader,
          Buffer.concat(val),
          Buffer.concat(value),
          expectedOffset,
        );
      });
    });
  });
});
