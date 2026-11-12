// Gabarits de tâches du client SIMULÉ (L16) : réalistes, avec les données nécessaires fournies dans la commande.
// Toutes les entreprises sont fictives (jamais une marque existante) ; le tirage est déterministe via le rng injecté.
import type { Profession, Rng } from "../shared/index.ts";

export interface TaskTemplate {
  title: string;
  prompt: string;
}

const COMPANIES = ["Atelier Lumio", "Brasserie des Trois Ponts", "Studio Vernis", "Maison Cordelia", "Ferme du Haut Chêne", "Velo Nomade", "Cabinet Archibald", "Librairie Papyrus Bleu", "Boulangerie Fournil Doré", "Kayak Rivière Claire"];
const SECTORS = ["restauration", "artisanat", "conseil", "librairie indépendante", "agriculture locale", "location de vélos", "design d'intérieur", "sport de plein air"];
const STYLES = ["minimaliste", "chaleureux et artisanal", "moderne et géométrique", "ludique", "élégant"];
const PRODUCTS = ["une gourde isotherme en acier recyclé", "un carnet de notes en papier recyclé", "une application de partage de trajets à vélo", "un service de livraison de paniers de légumes", "une lampe de bureau à LED sans fil"];
const TARGETS = ["jeunes actifs urbains", "familles", "petites entreprises locales", "étudiants", "retraités actifs"];
const SYSTEMS = [
  "une plateforme de réservation de salles de réunion pour 200 utilisateurs, avec notifications par e-mail",
  "une application mobile de suivi de livraisons avec carte en temps réel pour 5 000 coursiers",
  "un site de vente en ligne de produits locaux avec paiement par carte et gestion de stock",
  "un tableau de bord interne qui agrège les ventes de trois boutiques physiques",
];
const ACTIVITIES = [
  "vente en ligne d'objets artisanaux, clients particuliers en France et en Belgique",
  "micro-entreprise de conseil en informatique, clients professionnels",
  "association qui organise des ateliers de cuisine et encaisse des cotisations",
  "location saisonnière d'un gîte de quatre personnes",
];
const SOURCES: { dir: "en" | "fr"; text: string }[] = [
  { dir: "en", text: "Merci de votre patience, votre commande sera expédiée sous deux jours ouvrés." },
  { dir: "en", text: "Notre équipe est disponible du lundi au vendredi pour répondre à toutes vos questions." },
  { dir: "fr", text: "Please restart the application after installing the update so that the changes take effect." },
  { dir: "fr", text: "Your subscription will renew automatically unless you cancel it at least seven days before the renewal date." },
];
const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin"];

export function simTemplate(profession: Profession, rng: Rng): TaskTemplate {
  switch (profession) {
    case "logo": {
      const name = rng.pick(COMPANIES);
      return {
        title: `Logo pour ${name}`,
        prompt: `Entreprise : ${name}\nSecteur : ${rng.pick(SECTORS)}\nStyle souhaité : ${rng.pick(STYLES)}\nCrée 3 propositions de logo originales pour cette entreprise fictive.`,
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
        title: "Analyse de rentabilité sur quelques mois",
        prompt: `Voici les chiffres d'une petite entreprise (en euros) :\n\n| Mois | Revenus | Charges |\n|---|---|---|\n${rows.join("\n")}\n\nAnalyse la rentabilité : totaux, résultat de la période, tendance. N'utilise que ces chiffres.`,
      };
    }
    case "architecture":
      return { title: "Architecture d'un petit service", prompt: `Propose l'architecture de ${rng.pick(SYSTEMS)}. Contrainte : budget d'hébergement modeste, équipe de deux développeurs.` };
    case "marketing":
      return { title: "Texte de présentation produit", prompt: `Rédige un texte de présentation de 100 à 150 mots pour ${rng.pick(PRODUCTS)}. Cible : ${rng.pick(TARGETS)}. Ton : chaleureux, avec un appel à l'action.` };
    case "translation": {
      const s = rng.pick(SOURCES);
      return { title: s.dir === "en" ? "Traduction FR vers EN" : "Traduction EN vers FR", prompt: `Traduis en ${s.dir === "en" ? "anglais" : "français"} : « ${s.text} »` };
    }
    case "legal":
      return { title: "Checklist de conformité de base", prompt: `Établis une checklist juridique simple pour cette activité : ${rng.pick(ACTIVITIES)}.` };
  }
}
