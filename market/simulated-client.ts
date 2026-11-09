// Client SIMULÉ : poste des tâches variées à un rythme de Poisson. Toujours `requester.kind = "simulated"`,
// libellé toujours préfixé « Client simulé » (jamais présenté comme un vrai client). Financé par le compte maître.
import { PROFESSIONS, type Deps, type Market, type Profession, type Task } from "../shared/index.ts";

export const SIMULATED_LABEL_PREFIX = "Client simulé";

const TEMPLATES: Record<Profession, { title: string; prompt: string }[]> = {
  writer: [
    { title: "Slogan pour une boulangerie", prompt: "Écris trois slogans courts pour une boulangerie de quartier qui ouvre dès 6 h du matin." },
    { title: "Description de produit", prompt: "Rédige une description de 80 mots pour une gourde isotherme en acier recyclé." },
    { title: "Mot de bienvenue", prompt: "Écris un court message de bienvenue chaleureux pour les nouveaux membres d'un club de lecture." },
  ],
  translator: [
    { title: "Traduction FR vers EN", prompt: "Traduis en anglais : « Merci de votre patience, votre commande sera expédiée sous deux jours ouvrés. »" },
    { title: "Traduction EN vers FR", prompt: "Traduis en français : « Please restart the application after installing the update. »" },
  ],
  summarizer: [
    { title: "Résumé en trois points", prompt: "Résume en trois points : une startup lance une application de partage de trajets à vélo dans trois villes, financée par une levée de fonds de deux millions." },
    { title: "Résumé d'une réunion", prompt: "Résume en cinq lignes : l'équipe a décidé de reporter la sortie d'une semaine, de corriger deux bugs bloquants et de renforcer les tests." },
  ],
  analyst: [
    { title: "Avantages et risques", prompt: "Liste les avantages et les risques pour une petite entreprise qui passe au télétravail deux jours par semaine." },
    { title: "Comparaison de deux options", prompt: "Compare brièvement l'achat et la location d'un véhicule utilitaire pour un artisan, en quatre critères." },
  ],
  coder: [
    { title: "Fonction de tri", prompt: "Écris une fonction TypeScript qui trie un tableau d'objets {nom, age} par age croissant puis par nom." },
    { title: "Expression régulière", prompt: "Donne une expression régulière qui valide un code postal français à cinq chiffres, avec une explication courte." },
  ],
};

/** Tirage de Poisson (Knuth), borné pour éviter les rafales. */
export function poisson(rate: number, next: () => number, cap = 6): number {
  if (!(rate > 0)) return 0;
  const limit = Math.exp(-rate);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= next();
  } while (p > limit && k <= cap);
  return Math.min(k - 1, cap);
}

export interface SimulatedClient {
  /** Poste les tâches de ce tick et les renvoie. */
  tick(tick: number): Promise<Task[]>;
}

export function createSimulatedClient(deps: Deps, market: Market): SimulatedClient {
  const { rng, config } = deps;
  return {
    async tick() {
      const n = poisson(config.sim.simClientRatePerTick, () => rng.next());
      const posted: Task[] = [];
      for (let i = 0; i < n; i++) {
        const profession = rng.pick(PROFESSIONS);
        const tpl = rng.pick(TEMPLATES[profession]);
        const span = config.sim.taskBudgetMax - config.sim.taskBudgetMin;
        const budget = config.sim.taskBudgetMin + (span * BigInt(Math.floor(rng.next() * 1_000_000))) / 1_000_000n;
        posted.push(
          await market.postTask({
            requester: { kind: "simulated", label: `${SIMULATED_LABEL_PREFIX} #${rng.int(1, 9)}` },
            profession, title: tpl.title, prompt: tpl.prompt, budget: budget.toString(),
          }),
        );
      }
      return posted;
    },
  };
}
