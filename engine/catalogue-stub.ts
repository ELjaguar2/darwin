// STUB TEMPORAIRE (L16, moteur) : remplace `shared/catalogue.ts` tant que la branche marché n'est pas fusionnée.
// A la fusion : supprimer ce fichier et, dans engine/policy.ts, importer `CATALOGUE` depuis "../shared/catalogue.ts".
// Interface attendue : CATALOGUE[profession].nearPrice : bigint (Yocto), prix plancher de référence du métier.
import { PROFESSIONS, parseNear, toYocto, type Profession } from "../shared/index.ts";

export const CATALOGUE: Record<Profession, { nearPrice: bigint }> = Object.fromEntries(
  PROFESSIONS.map((p) => [p, { nearPrice: BigInt(toYocto(parseNear("0.01"))) }]),
) as Record<Profession, { nearPrice: bigint }>;
