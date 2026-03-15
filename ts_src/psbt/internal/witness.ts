import * as varuint from 'varuint-bitcoin';

export function scriptWitnessToWitnessStack(buffer: Uint8Array): Uint8Array[] {
  let offset = 0;

  function readSlice(n: number): Uint8Array {
    offset += n;
    return buffer.slice(offset - n, offset);
  }

  function readVarInt(): number {
    const vi = varuint.decode(buffer, offset);
    offset += varuint.encodingLength(vi.bigintValue);
    return vi.numberValue!;
  }

  function readVarSlice(): Uint8Array {
    return readSlice(readVarInt());
  }

  function readVector(): Uint8Array[] {
    const count = readVarInt();
    const vector: Uint8Array[] = [];
    for (let i = 0; i < count; i++) vector.push(readVarSlice());
    return vector;
  }

  return readVector();
}
