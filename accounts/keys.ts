// Garde des clés. Règles : jamais en clair dans le dépôt, jamais journalisées, jamais dans un message d'erreur.
//  - `Secret` masque la valeur (toString, JSON, util.inspect) : il faut appeler reveal() explicitement.
//  - `MemoryKeyStore` : tests et mode mock (rien sur disque).
//  - `FileKeyStore` : un fichier `*.key` par clé dans un dossier ignoré par git (par défaut `<dataDir>/keys` ; `data/` et `*.key`
//    sont dans .gitignore), permissions 0600 (effectives sous POSIX ; sous Windows, protéger le dossier par ACL utilisateur).
import { createPrivateKey, createPublicKey, generateKeyPairSync } from "node:crypto";
import { chmod, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { inspect } from "node:util";
import { base58Decode, base58Encode } from "./base58.ts";

export class Secret {
  readonly #v: string;
  constructor(v: string) {
    this.#v = v;
  }
  reveal(): string {
    return this.#v;
  }
  toString(): string {
    return "[SECRET]";
  }
  toJSON(): string {
    return "[SECRET]";
  }
  [inspect.custom](): string {
    return "[SECRET]";
  }
}

export interface GeneratedKey {
  publicKey: string; // "ed25519:<base58>"
  secretKey: Secret; // "ed25519:<base58 de seed||pub, 64 octets>" (format KeyPairString de near-api-js)
}

/** Génère une paire ed25519 au format NEAR. */
export function generateKey(): GeneratedKey {
  const { privateKey } = generateKeyPairSync("ed25519");
  const jwk = privateKey.export({ format: "jwk" });
  const seed = Buffer.from(jwk.d as string, "base64url");
  const pub = Buffer.from(jwk.x as string, "base64url");
  return {
    publicKey: `ed25519:${base58Encode(pub)}`,
    secretKey: new Secret(`ed25519:${base58Encode(Buffer.concat([seed, pub]))}`),
  };
}

/** Clé publique d'une clé secrète NEAR (vérifier la clé fournie par l'humain). Message d'erreur sans la clé. */
export function publicKeyOf(secretKey: Secret): string {
  const raw = secretKey.reveal();
  if (!raw.startsWith("ed25519:")) throw new Error("Format de clé non supporté (ed25519: attendu)");
  let bytes: Uint8Array;
  try {
    bytes = base58Decode(raw.slice(8));
  } catch {
    throw new Error("Clé secrète ed25519 invalide");
  }
  if (bytes.length !== 64) throw new Error("Clé secrète ed25519 invalide");
  const priv = createPrivateKey({
    key: { kty: "OKP", crv: "Ed25519", d: Buffer.from(bytes.subarray(0, 32)).toString("base64url"), x: Buffer.from(bytes.subarray(32)).toString("base64url") },
    format: "jwk",
  });
  const jwk = createPublicKey(priv).export({ format: "jwk" });
  return `ed25519:${base58Encode(Buffer.from(jwk.x as string, "base64url"))}`;
}

/** `full` : accès complet (virements, suppression à la mort). `fc` : function call à droits limités. */
export type KeyRole = "full" | "fc";

export interface StoredKey {
  accountId: string;
  role: KeyRole;
  publicKey: string;
  secretKey: Secret;
}

export interface KeyStore {
  put(accountId: string, role: KeyRole, key: GeneratedKey): Promise<void>;
  get(accountId: string, role: KeyRole): Promise<StoredKey | null>;
  /** Supprime les clés du compte (toutes, ou un seul rôle). */
  remove(accountId: string, role?: KeyRole): Promise<void>;
  /** Informations publiques seulement. */
  list(): Promise<Array<{ accountId: string; role: KeyRole; publicKey: string }>>;
}

export class MemoryKeyStore implements KeyStore {
  private m = new Map<string, StoredKey>();
  async put(accountId: string, role: KeyRole, key: GeneratedKey) {
    this.m.set(`${accountId}|${role}`, { accountId, role, ...key });
  }
  async get(accountId: string, role: KeyRole) {
    return this.m.get(`${accountId}|${role}`) ?? null;
  }
  async remove(accountId: string, role?: KeyRole) {
    for (const r of role ? [role] : (["full", "fc"] as const)) this.m.delete(`${accountId}|${r}`);
  }
  async list() {
    return [...this.m.values()].map((k) => ({ accountId: k.accountId, role: k.role, publicKey: k.publicKey }));
  }
}

const ACCOUNT_RE = /^[a-z0-9._-]{2,64}$/;

export class FileKeyStore implements KeyStore {
  constructor(private dir: string) {}

  private path(accountId: string, role: KeyRole): string {
    if (!ACCOUNT_RE.test(accountId) || accountId.includes("..")) throw new Error("Identifiant de compte invalide pour le stockage des clés");
    return join(this.dir, `${accountId}.${role}.key`);
  }

  async put(accountId: string, role: KeyRole, key: GeneratedKey) {
    await mkdir(this.dir, { recursive: true, mode: 0o700 });
    const p = this.path(accountId, role);
    await writeFile(p, JSON.stringify({ accountId, role, publicKey: key.publicKey, secretKey: key.secretKey.reveal() }), { mode: 0o600 });
    await chmod(p, 0o600).catch(() => undefined);
  }

  async get(accountId: string, role: KeyRole): Promise<StoredKey | null> {
    try {
      const j = JSON.parse(await readFile(this.path(accountId, role), "utf8")) as { publicKey: string; secretKey: string };
      return { accountId, role, publicKey: j.publicKey, secretKey: new Secret(j.secretKey) };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw new Error(`Lecture de la clé impossible pour ${accountId} (${role})`); // sans contenu du fichier
    }
  }

  async remove(accountId: string, role?: KeyRole) {
    for (const r of role ? [role] : (["full", "fc"] as const)) await rm(this.path(accountId, r), { force: true });
  }

  async list() {
    let names: string[];
    try {
      names = await readdir(this.dir);
    } catch {
      return [];
    }
    const out: Array<{ accountId: string; role: KeyRole; publicKey: string }> = [];
    for (const n of names.filter((x) => x.endsWith(".key"))) {
      try {
        const j = JSON.parse(await readFile(join(this.dir, n), "utf8")) as { accountId: string; role: KeyRole; publicKey: string };
        out.push({ accountId: j.accountId, role: j.role, publicKey: j.publicKey });
      } catch {
        /* fichier illisible ignoré */
      }
    }
    return out;
  }
}
