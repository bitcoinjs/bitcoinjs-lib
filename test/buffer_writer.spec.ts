import * as assert from 'assert';
import { describe, it } from 'mocha';
import { BufferWriter } from '../src/bufferutils';

const varuint = require('varuint-bitcoin');

describe('BufferWriter', () => {
  function concatToBuffer(values: number[][]): Buffer {
    return Buffer.concat(values.map(data => Buffer.from(data)));
  }

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
          (sum: number, v) => sum + varuint.encodingLength(v.length) + v.length,
          0,
        );
      bufferWriter.writeVector(value);
      testBuffer(bufferWriter, expectedBuffer, expectedOffset);
    });
    testBuffer(bufferWriter, expectedBuffer);
  });
});
