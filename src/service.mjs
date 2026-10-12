// Le service de depot : la base (D1, ou toute base qui en a la forme), les
// plafonds, le temoin et la reponse. Les Functions ne font que le brancher.

import { surSiteOfficiel } from './acte.mjs';
import { nommeUnePersonne } from './personne.mjs';
import { sha256 } from './chaine.mjs';
import { cleDAdresse, idDuRecu, jourDe, ligneDe, lireDemande, plafond, recuDe, secondesAvantDemain, selAleatoire } from './depot.mjs';
import { AGENT, DELAI_MS, cleDeLecture, estUneIp, ipsDoH, lireBorne, resolutionAdmise, sautSuivant, urlAdmise } from './temoin.mjs';

/** Le schema de la base `empreintes-depots` ; rejouable. */
export const SCHEMA = [
	'CREATE TABLE IF NOT EXISTS depot (jour TEXT NOT NULL, place INTEGER NOT NULL, sha256 TEXT NOT NULL, recu TEXT NOT NULL, PRIMARY KEY (jour, place)) WITHOUT ROWID',
	'CREATE TABLE IF NOT EXISTS compte (jour TEXT NOT NULL, adresse TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (jour, adresse)) WITHOUT ROWID',
	'CREATE TABLE IF NOT EXISTS lecture (cle TEXT PRIMARY KEY, jour TEXT NOT NULL) WITHOUT ROWID',
	'CREATE TABLE IF NOT EXISTS sel (jour TEXT PRIMARY KEY, valeur TEXT NOT NULL) WITHOUT ROWID',
	'CREATE TABLE IF NOT EXISTS bilan (jour TEXT PRIMARY KEY, depots INTEGER NOT NULL, deposants INTEGER NOT NULL) WITHOUT ROWID',
	// `objet` et `url` ajoutes le 2026-10-12 par ALTER TABLE sur la base en service ; null pour les actes d'avant.
	'CREATE TABLE IF NOT EXISTS acte (recu TEXT PRIMARY KEY, collectivite TEXT NOT NULL, nature TEXT NOT NULL, objet TEXT, url TEXT) WITHOUT ROWID',
	'CREATE INDEX IF NOT EXISTS acte_collectivite ON acte (collectivite)',
	// D-170 : les flux suivis, leurs articles et les versions deposees. `jeton` est le sha256 du jeton rendu a l'inscription.
	'CREATE TABLE IF NOT EXISTS flux (id TEXT PRIMARY KEY, url TEXT NOT NULL UNIQUE, jeton TEXT NOT NULL, inscrit TEXT NOT NULL, retire TEXT, reprise TEXT, lu TEXT, etat TEXT) WITHOUT ROWID',
	'CREATE TABLE IF NOT EXISTS article (flux TEXT NOT NULL, id TEXT NOT NULL, lien TEXT NOT NULL, empreinte TEXT, octets TEXT, essaye TEXT, lu TEXT, PRIMARY KEY (flux, id)) WITHOUT ROWID',
	'CREATE TABLE IF NOT EXISTS version (recu TEXT PRIMARY KEY, flux TEXT NOT NULL, article TEXT NOT NULL, jour TEXT NOT NULL, contenu TEXT NOT NULL) WITHOUT ROWID',
	'CREATE INDEX IF NOT EXISTS version_jour ON version (jour)',
	'CREATE INDEX IF NOT EXISTS version_article ON version (flux, article)',
	'CREATE INDEX IF NOT EXISTS depot_recu ON depot (recu)',
	'CREATE INDEX IF NOT EXISTS depot_sha256 ON depot (sha256)'
];

const JSON_UTF8 = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*' };
const reponse = (statut, corps, entetes = {}) => ({ statut, corps: `${JSON.stringify(corps, null, 1)}\n`, entetes: { ...JSON_UTF8, ...entetes } });
const refus = (statut, erreur, details = [], entetes = {}) => reponse(statut, { erreur, details }, entetes);

const un = (db, sql, ...args) => db.prepare(sql).bind(...args).first();
const faire = (db, sql, ...args) => db.prepare(sql).bind(...args).run();

/** Le sel du jour : tire une fois, jete le lendemain avec les compteurs et les lectures. */
async function selDuJour(db, jour) {
	await faire(db, 'DELETE FROM sel WHERE jour < ?', jour);
	// Le compte des jours passes ne survit qu'en agregat : combien de depots, combien d'adresses distinctes ce jour-la.
	await faire(db, 'INSERT INTO bilan (jour, depots, deposants) SELECT jour, SUM(n), COUNT(*) FROM compte WHERE jour < ? GROUP BY jour ON CONFLICT (jour) DO NOTHING', jour);
	await faire(db, 'DELETE FROM compte WHERE jour < ?', jour);
	await faire(db, 'DELETE FROM lecture WHERE jour < ?', jour);
	await faire(db, 'INSERT INTO sel (jour, valeur) VALUES (?, ?) ON CONFLICT (jour) DO NOTHING', jour, selAleatoire());
	return (await un(db, 'SELECT valeur FROM sel WHERE jour = ?', jour)).valeur;
}

/** Les adresses IP d'un hote, en A et AAAA, par un resolveur DoH au format JSON. */
export async function resoudreParDoH(hote, { fetch: f = fetch, resolveur = 'https://cloudflare-dns.com/dns-query' } = {}) {
	const lire = async (type) => {
		const r = await f(`${resolveur}?name=${encodeURIComponent(hote)}&type=${type}`, { headers: { accept: 'application/dns-json' } });
		if (!r.ok) throw new Error(`resolution ${type} : ${r.status}`);
		return ipsDoH(await r.json());
	};
	return [...(await lire('A')), ...(await lire('AAAA'))];
}

/**
 * Le temoin : lit l'URL lui-meme, chaque saut regarde (protocole, port, hote,
 * resolution), dans ses bornes, et rend ce qu'il a lu (les octets aussi avec
 * `garder`). Leve avec le motif, et `statut` quand la source a repondu.
 */
export async function temoigner(admise, { fetch: f = fetch, resoudre = (h) => resoudreParDoH(h), maintenant = () => Date.now(), garder = false } = {}) {
	const debut = maintenant();
	let courante = admise;
	for (let sauts = 0; ; sauts++) {
		if (!estUneIp(courante.hote)) {
			const verdict = resolutionAdmise(await resoudre(courante.hote));
			if (verdict.refus) throw new Error(verdict.refus);
		}
		const r = await f(courante.url, { redirect: 'manual', headers: { 'user-agent': AGENT, accept: '*/*' }, signal: AbortSignal.timeout(DELAI_MS) });
		if (r.status >= 300 && r.status < 400) {
			await r.body?.cancel();
			const suite = sautSuivant({ courante: courante.url, statut: r.status, location: r.headers.get('location'), sauts });
			if (suite.refus) throw new Error(suite.refus);
			courante = suite;
			continue;
		}
		if (!r.ok) {
			await r.body?.cancel();
			throw Object.assign(new Error(`la source a repondu ${r.status}`), { statut: r.status });
		}
		const octets = r.body ? await lireBorne(r.body.getReader(), { debut, maintenant }) : new Uint8Array(0);
		const lu = { url: courante.url, taille: octets.byteLength, type: r.headers.get('content-type'), lu: new Date(maintenant()).toISOString(), sha256: await sha256(octets) };
		return garder ? { ...lu, octets } : lu;
	}
}

/** Prend la place suivante du jour, dans la meme instruction que l'insertion. */
export async function inserer(db, { jour, empreinte, recu }) {
	const sql =
		'INSERT INTO depot (jour, place, sha256, recu) SELECT ?, COALESCE(MAX(place), 0) + 1, ?, ? FROM depot WHERE jour = ? RETURNING place';
	try {
		return (await un(db, sql, jour, empreinte, recu, jour)).place;
	} catch {
		return (await un(db, sql, jour, empreinte, recu, jour)).place;
	}
}

/**
 * Le rattachement d'un acte : `site-officiel` quand l'adresse demandee ET
 * l'adresse lue sont sur un site que l'annuaire donne a la collectivite,
 * `declaree` sinon, et aussi quand l'annuaire ne repond pas.
 */
async function rattachement({ acte, demandee, lue, annuaire }) {
	let sites = null;
	try {
		sites = await annuaire(acte.collectivite);
	} catch {
		sites = null;
	}
	return surSiteOfficiel(demandee, sites) && surSiteOfficiel(lue, sites) ? 'site-officiel' : 'declaree';
}

/** L'adresse lue d'un acte, montree sur la page de sa collectivite ; null quand son chemin nomme une personne. */
export function adressePublique(url) {
	let chemin;
	try {
		chemin = decodeURIComponent(new URL(url).pathname);
	} catch {
		return null;
	}
	return nommeUnePersonne(chemin.replace(/[/_.-]+/g, ' ')) ? null : url;
}

/**
 * Un depot, de la demande a la reponse : `{ statut, corps, entetes }`.
 * `adresse` n'est jamais gardee : seul son hache sale du jour compte.
 * `annuaire(code)` rend les sites officiels d'une collectivite, `[hote, prefixe]`.
 */
export async function deposer({ db, corps, adresse, maintenant = new Date(), temoin = temoigner, annuaire = async () => null }) {
	const { demande, erreurs } = lireDemande(corps);
	if (erreurs) return refus(400, 'demande illisible', erreurs);
	const instant = maintenant.toISOString();
	const jour = jourDe(instant);
	const cle = await cleDAdresse(adresse ?? 'inconnue', await selDuJour(db, jour));
	// Les versions des flux suivis (D-170) ont leurs propres plafonds, hors de celui des depots exterieurs.
	const duJour =
		(await un(db, 'SELECT COALESCE(MAX(place), 0) AS n FROM depot WHERE jour = ?', jour)).n - (await un(db, 'SELECT COUNT(*) AS n FROM version WHERE jour = ?', jour)).n;
	const deCetteAdresse = (await un(db, 'SELECT n FROM compte WHERE jour = ? AND adresse = ?', jour, cle))?.n ?? 0;
	const limite = plafond({ deCetteAdresse, duJour, instant });
	if (!limite.ok) return refus(429, limite.motif, [], { 'retry-after': String(limite.apres) });

	let empreinte = demande.sha256;
	let lu = null;
	if (demande.url) {
		const admise = urlAdmise(demande.url);
		if (admise.refus) return refus(400, 'url refusee', [admise.refus]);
		const nouvelle = await faire(db, 'INSERT INTO lecture (cle, jour) VALUES (?, ?) ON CONFLICT (cle) DO NOTHING', await cleDeLecture(admise.url, jour), jour);
		if (nouvelle.meta.changes === 0) return refus(409, 'url deja lue aujourd hui', [], { 'retry-after': String(secondesAvantDemain(instant)) });
		try {
			lu = await temoin(admise);
		} catch (erreur) {
			return refus(422, 'lecture impossible', [String(erreur?.message ?? erreur)]);
		}
		empreinte = lu.sha256;
	}

	const acte = demande.acte ? { ...demande.acte, rattachement: await rattachement({ acte: demande.acte, demandee: demande.url, lue: lu.url, annuaire }) } : null;
	const recu = recuDe({ sha256: empreinte, instant, libelle: demande.libelle, url: demande.url, temoin: lu, acte });
	const id = await idDuRecu(recu);
	const place = await inserer(db, { jour, empreinte, recu: id });
	// La serie d'une collectivite ne tient que les actes lus sur son site officiel ; un acte declare reste dans son recu.
	if (acte?.rattachement === 'site-officiel')
		await faire(db, 'INSERT INTO acte (recu, collectivite, nature, objet, url) VALUES (?, ?, ?, ?, ?)', id, acte.collectivite, acte.nature, demande.libelle ?? null, adressePublique(lu.url));
	await faire(db, 'INSERT INTO compte (jour, adresse, n) VALUES (?, ?, 1) ON CONFLICT (jour, adresse) DO UPDATE SET n = n + 1', jour, cle);
	return reponse(201, { jour, place, ligne: ligneDe({ sha256: empreinte, jour, place, recu: id }).trim(), id, recu });
}

const FICHIER = /^(\d{4}-\d{2}-\d{2})\.jsonl$/;

/** Le fichier public d'un jour : ses lignes dans l'ordre des places, rien d'autre. */
export async function fichierDuJour({ db, nom, maintenant = new Date() }) {
	const m = FICHIER.exec(nom ?? '');
	if (!m || Number.isNaN(Date.parse(m[1]))) return { statut: 404, corps: 'fichier inconnu\n', entetes: { 'content-type': 'text/plain; charset=utf-8' } };
	const { results } = await db.prepare('SELECT sha256, jour, place, recu FROM depot WHERE jour = ? ORDER BY place').bind(m[1]).all();
	const clos = m[1] < jourDe(maintenant.toISOString());
	return {
		statut: 200,
		corps: results.map(ligneDe).join(''),
		entetes: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': `public, max-age=${clos ? 3600 : 60}`, 'access-control-allow-origin': '*' }
	};
}

const HEX64 = /^[0-9a-f]{64}$/;
const COLONNES = 'SELECT sha256, jour, place, recu FROM depot';

/** La ligne publique d'un recu, par son identifiant ; null s'il est inconnu. */
export async function ligneDuRecu({ db, id }) {
	if (!HEX64.test(id ?? '')) return null;
	return un(db, `${COLONNES} WHERE recu = ?`, id);
}

/** Les lignes publiques qui portent une empreinte, dans l'ordre des jours et des places. */
export async function lignesDeLEmpreinte({ db, empreinte }) {
	if (!HEX64.test(empreinte ?? '')) return null;
	return (await db.prepare(`${COLONNES} WHERE sha256 = ? ORDER BY jour, place`).bind(empreinte).all()).results;
}

/** La reponse JSON d'une lecture publique : 404 sur l'inconnu, cache court sinon. */
export function lecturePublique(valeur) {
	if (valeur === null) return refus(404, 'inconnu');
	return reponse(200, valeur, { 'cache-control': 'public, max-age=60' });
}

/**
 * Le bilan public, jour par jour : depots et deposants distincts (adresses
 * distinctes ce jour-la, jamais suivies d'un jour a l'autre). Les jours clos
 * viennent de `bilan`, le jour en cours et les jours pas encore purges du
 * compteur vivant.
 */
export async function bilanPublic({ db }) {
	const { results } = await db
		.prepare('SELECT jour, depots, deposants FROM bilan UNION ALL SELECT jour, SUM(n) AS depots, COUNT(*) AS deposants FROM compte GROUP BY jour ORDER BY jour')
		.all();
	const jours = results.map((r) => ({ jour: r.jour, depots: Number(r.depots), deposants: Number(r.deposants) }));
	return { jours, deposantsAuMoins: Math.max(0, ...jours.map((j) => j.deposants)) };
}

/** Au plus tant d'actes sur la page d'une collectivite ; le compte dit les autres. */
export const SERIE_MAX = 500;

/**
 * La serie publique d'une collectivite : ses actes rattaches, du plus recent au
 * plus ancien, sous chacun de ses codes (INSEE et SIREN) : la ligne publique,
 * la nature, l'objet donne au depot et l'adresse lue sur le site officiel.
 */
export async function serieDeLaCollectivite({ db, codes, limite = SERIE_MAX }) {
	const marques = codes.map(() => '?').join(', ');
	const total = Number((await un(db, `SELECT COUNT(*) AS n FROM acte WHERE collectivite IN (${marques})`, ...codes)).n);
	const { results } = await db
		.prepare(`SELECT d.jour, d.place, d.sha256, d.recu, a.nature, a.objet, a.url FROM acte a JOIN depot d ON d.recu = a.recu WHERE a.collectivite IN (${marques}) ORDER BY d.jour DESC, d.place DESC LIMIT ?`)
		.bind(...codes, limite)
		.all();
	return { total, actes: results };
}

/** L'acte rattache que porte un recu, `{ collectivite, nature, objet, url }` ; null pour tout autre depot. */
export async function acteDuRecu({ db, id }) {
	if (!HEX64.test(id ?? '')) return null;
	return un(db, 'SELECT collectivite, nature, objet, url FROM acte WHERE recu = ?', id);
}
