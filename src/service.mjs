// Le service de depot : la base (D1, ou toute base qui en a la forme), les
// plafonds, le temoin et la reponse. Les Functions ne font que le brancher.

import { sha256 } from './chaine.mjs';
import { cleDAdresse, idDuRecu, jourDe, ligneDe, lireDemande, plafond, recuDe, secondesAvantDemain, selAleatoire } from './depot.mjs';
import { AGENT, DELAI_MS, cleDeLecture, estUneIp, ipsDoH, lireBorne, resolutionAdmise, sautSuivant, urlAdmise } from './temoin.mjs';

/** Le schema de la base `empreintes-depots` ; rejouable. */
export const SCHEMA = [
	'CREATE TABLE IF NOT EXISTS depot (jour TEXT NOT NULL, place INTEGER NOT NULL, sha256 TEXT NOT NULL, recu TEXT NOT NULL, PRIMARY KEY (jour, place)) WITHOUT ROWID',
	'CREATE TABLE IF NOT EXISTS compte (jour TEXT NOT NULL, adresse TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (jour, adresse)) WITHOUT ROWID',
	'CREATE TABLE IF NOT EXISTS lecture (cle TEXT PRIMARY KEY, jour TEXT NOT NULL) WITHOUT ROWID',
	'CREATE TABLE IF NOT EXISTS sel (jour TEXT PRIMARY KEY, valeur TEXT NOT NULL) WITHOUT ROWID'
];

const JSON_UTF8 = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*' };
const reponse = (statut, corps, entetes = {}) => ({ statut, corps: `${JSON.stringify(corps, null, 1)}\n`, entetes: { ...JSON_UTF8, ...entetes } });
const refus = (statut, erreur, details = [], entetes = {}) => reponse(statut, { erreur, details }, entetes);

const un = (db, sql, ...args) => db.prepare(sql).bind(...args).first();
const faire = (db, sql, ...args) => db.prepare(sql).bind(...args).run();

/** Le sel du jour : tire une fois, jete le lendemain avec les compteurs et les lectures. */
async function selDuJour(db, jour) {
	await faire(db, 'DELETE FROM sel WHERE jour < ?', jour);
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
 * resolution), dans ses bornes, et rend ce qu'il a lu. Leve avec le motif.
 */
export async function temoigner(admise, { fetch: f = fetch, resoudre = (h) => resoudreParDoH(h), maintenant = () => Date.now() } = {}) {
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
			throw new Error(`la source a repondu ${r.status}`);
		}
		const octets = r.body ? await lireBorne(r.body.getReader(), { debut, maintenant }) : new Uint8Array(0);
		return { url: courante.url, taille: octets.byteLength, type: r.headers.get('content-type'), lu: new Date(maintenant()).toISOString(), sha256: await sha256(octets) };
	}
}

/** Prend la place suivante du jour, dans la meme instruction que l'insertion. */
async function inserer(db, { jour, empreinte, recu }) {
	const sql =
		'INSERT INTO depot (jour, place, sha256, recu) SELECT ?, COALESCE(MAX(place), 0) + 1, ?, ? FROM depot WHERE jour = ? RETURNING place';
	try {
		return (await un(db, sql, jour, empreinte, recu, jour)).place;
	} catch {
		return (await un(db, sql, jour, empreinte, recu, jour)).place;
	}
}

/**
 * Un depot, de la demande a la reponse : `{ statut, corps, entetes }`.
 * `adresse` n'est jamais gardee : seul son hache sale du jour compte.
 */
export async function deposer({ db, corps, adresse, maintenant = new Date(), temoin = temoigner }) {
	const { demande, erreurs } = lireDemande(corps);
	if (erreurs) return refus(400, 'demande illisible', erreurs);
	const instant = maintenant.toISOString();
	const jour = jourDe(instant);
	const cle = await cleDAdresse(adresse ?? 'inconnue', await selDuJour(db, jour));
	const duJour = (await un(db, 'SELECT COALESCE(MAX(place), 0) AS n FROM depot WHERE jour = ?', jour)).n;
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

	const recu = recuDe({ sha256: empreinte, instant, libelle: demande.libelle, url: demande.url, temoin: lu });
	const id = await idDuRecu(recu);
	const place = await inserer(db, { jour, empreinte, recu: id });
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
