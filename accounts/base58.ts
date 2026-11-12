// Base58 (Bitcoin alphabet, the one NEAR uses for `ed25519:...` keys). No dependency.
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function base58Encode(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  let n = 0n;
  for (const b of bytes) n = n * 256n + BigInt(b);
  let out = "";
  while (n > 0n) {
    out = ALPHABET[Number(n % 58n)] + out;
    n /= 58n;
  }
  return "1".repeat(zeros) + out;
}

export function base58Decode(s: string): Uint8Array {
  let zeros = 0;
  while (zeros < s.length && s[zeros] === "1") zeros++;
  let n = 0n;
  for (const c of s) {
    const i = ALPHABET.indexOf(c);
    if (i < 0) throw new Error("invalid base58");
    n = n * 58n + BigInt(i);
  }
  const bytes: number[] = [];
  while (n > 0n) {
    bytes.unshift(Number(n % 256n));
    n /= 256n;
  }
  return Uint8Array.from([...new Array<number>(zeros).fill(0), ...bytes]);
}
