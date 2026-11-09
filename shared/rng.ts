/** PRNG déterministe (mulberry32) : même graine = même simulation (tests reproductibles). */
export interface Rng {
  /** Flottant dans [0,1). */
  next(): number;
  int(min: number, max: number): number;
  pick<T>(arr: readonly T[]): T;
  /** Gaussienne approchée (Box-Muller). */
  gauss(mean?: number, sd?: number): number;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)] as never,
    gauss: (mean = 0, sd = 1) => {
      const u = Math.max(next(), 1e-12);
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
    },
  };
}
