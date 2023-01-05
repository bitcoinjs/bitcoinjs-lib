const { sha256 } = require('../src/crypto');
const { TAGS } = require('../src/tags');
const fs = require('fs');
const path = require('path');

const taggedHashPrefixes = Object.fromEntries(
  TAGS.map(tag => {
    const tagHash = sha256(Buffer.from(tag));
    return [tag, Buffer.concat([tagHash, tagHash]).toString('hex')];
  }),
);

let content = `
interface StringMap {
  [key: string]: string;
}
export const TAGGED_HASH_PREFIXES_HEX: StringMap = ${JSON.stringify(
  taggedHashPrefixes,
)}
`;

fs.writeFileSync(
  path.resolve(__dirname, '../ts_src', 'tagged-hash-prefixes.ts'),
  content,
  { encoding: 'utf8', flag: 'w' },
);
