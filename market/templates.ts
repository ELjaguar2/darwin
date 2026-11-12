// Task templates of the SIMULATED client (L16): realistic, with the data needed provided in the order.
// All companies are fictional (never an existing brand); drawing is deterministic through the injected rng.
// L19: titles and prompts are in English. Translation tasks always go INTO English (the source texts are French, the target is English).
// The source text is delimited by « » (a delimiter, not a language choice: the mock brain and checks.ts parse it).
import type { Profession, Rng } from "../shared/index.ts";

export interface TaskTemplate {
  title: string;
  prompt: string;
}

const COMPANIES = ["Atelier Lumio", "Three Bridges Brewery", "Studio Vernis", "Maison Cordelia", "High Oak Farm", "Velo Nomade", "Archibald Consulting", "Blue Papyrus Bookshop", "Golden Oven Bakery", "Clear River Kayaks"];
const SECTORS = ["restaurants", "crafts", "consulting", "independent bookshop", "local farming", "bike rental", "interior design", "outdoor sports"];
const STYLES = ["minimalist", "warm and artisanal", "modern and geometric", "playful", "elegant"];
const PRODUCTS = ["an insulated water bottle made of recycled steel", "a notebook made of recycled paper", "an app for sharing bike rides", "a vegetable box delivery service", "a cordless LED desk lamp"];
const TARGETS = ["young urban professionals", "families", "small local businesses", "students", "active retirees"];
const SYSTEMS = [
  "a meeting-room booking platform for 200 users, with email notifications",
  "a mobile delivery-tracking app with a real-time map for 5,000 couriers",
  "an online shop for local products with card payment and stock management",
  "an internal dashboard that aggregates the sales of three physical shops",
];
const ACTIVITIES = [
  "online sale of handmade items, private customers in France and Belgium",
  "IT consulting micro-business, professional customers",
  "association that runs cooking workshops and collects membership fees",
  "seasonal rental of a four-person holiday cottage",
];
/** French source texts: every simulated translation task goes into English. */
const SOURCES: string[] = [
  "Merci de votre patience, votre commande sera expédiée sous deux jours ouvrés.",
  "Notre équipe est disponible du lundi au vendredi pour répondre à toutes vos questions.",
  "Veuillez redémarrer l'application après l'installation de la mise à jour afin que les changements prennent effet.",
  "Votre abonnement sera renouvelé automatiquement, sauf résiliation au moins sept jours avant la date d'échéance.",
];
const MONTHS = ["January", "February", "March", "April", "May", "June"];

export function simTemplate(profession: Profession, rng: Rng): TaskTemplate {
  switch (profession) {
    case "logo": {
      const name = rng.pick(COMPANIES);
      return {
        title: `Logo for ${name}`,
        prompt: `Company: ${name}\nSector: ${rng.pick(SECTORS)}\nDesired style: ${rng.pick(STYLES)}\nCreate 3 original logo proposals for this fictional company.`,
      };
    }
    case "finance": {
      const n = rng.int(4, 6);
      let rev = rng.int(30, 60) * 100;
      const rows = MONTHS.slice(0, n).map((m) => {
        rev += rng.int(-3, 6) * 100;
        const charges = Math.round(rev * (0.55 + rng.next() * 0.3) / 10) * 10;
        return `| ${m} | ${rev} | ${charges} |`;
      });
      return {
        title: "Profitability analysis over a few months",
        prompt: `Here are the figures of a small business (in euros):\n\n| Month | Revenue | Costs |\n|---|---|---|\n${rows.join("\n")}\n\nAnalyse the profitability: totals, result of the period, trend. Use only these figures.`,
      };
    }
    case "architecture":
      return { title: "Architecture of a small service", prompt: `Propose the architecture of ${rng.pick(SYSTEMS)}. Constraint: modest hosting budget, a team of two developers.` };
    case "marketing":
      return { title: "Product presentation text", prompt: `Write a presentation text of 100 to 150 words for ${rng.pick(PRODUCTS)}. Target: ${rng.pick(TARGETS)}. Tone: warm, with a call to action.` };
    case "translation":
      return { title: "Translation FR to EN", prompt: `Translate into English: « ${rng.pick(SOURCES)} »` };
    case "legal":
      return { title: "Basic compliance checklist", prompt: `Draw up a simple legal checklist for this activity: ${rng.pick(ACTIVITIES)}.` };
  }
}
