// La glane des actes des communes (D-178), un passage : pour chaque commune des
// departements demandes, lit poliment son site officiel (robots.txt respecte,
// un appel par hote toutes les 5 s, agent nomme, un refus laisse le site pour
// le jour), trouve ses PDF d'actes et les fait dater par le temoin, sous le
// jeton de la flotte. Ne depose qu'un PDF qu'il n'a jamais depose.
//
//   JETON_FLOTTE=... node scripts/glaner-actes.mjs --departements 17,37 --etat <dossier>
//     [--base https://temoinpublic.fr] [--paralleles 6] [--par-commune 40] [--communes-max N] [--sec]
//
// L'etat (`glane.json` : robots.txt lus, PDF deja deposes) et le releve du jour
// (`glane-<jour>.tsv`, une ligne par commune) vivent dans `--etat`, hors du depot.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { DEPARTEMENTS } from '../src/departements.mjs';
import { AGENT_GLANE, acteDuLien, liensDe, pagesCandidates, pdfsDe, reglesRobots, robotsPermet } from '../src/glane.mjs';

const { values: options } = parseArgs({
	options: {
		departements: { type: 'string' },
		etat: { type: 'string' },
		base: { type: 'string', default: 'https://temoinpublic.fr' },
		paralleles: { type: 'string', default: '6' },
		'par-commune': { type: 'string', default: '40' },
		'communes-max': { type: 'string', default: '0' },
		sec: { type: 'boolean', default: false }
	}
});
if (!options.departements || !options.etat) {
	console.error('usage : --departements 17,37 --etat <dossier> [--sec]');
	process.exit(2);
}
const JETON = process.env.JETON_FLOTTE;
if (!JETON && !options.sec) {
	console.error('JETON_FLOTTE absent : --sec pour une lecture sans depot');
	process.exit(2);
}

const INTERVALLE_MS = 5000;
const DELAI_MS = 20000;
const OCTETS_MAX = 3e6;
const ROBOTS_DUREE_MS = 7 * 24 * 3600 * 1000;
const REFUS = new Set([403, 418, 429, 503]);
const ESSAIS_MAX = 3;
const jour = new Date().toISOString().slice(0, 10);
fs.mkdirSync(options.etat, { recursive: true });
const fichierEtat = path.join(options.etat, 'glane.json');
const etat = fs.existsSync(fichierEtat) ? JSON.parse(fs.readFileSync(fichierEtat, 'utf8')) : { robots: {}, pdfs: {} };
const sauver = () => fs.writeFileSync(fichierEtat, `${JSON.stringify(etat)}\n`);

// Un appel par hote toutes les INTERVALLE_MS, file par hote ; un hote qui refuse est laisse pour le passage.
const prochain = new Map();
const refuses = new Set();
async function tourDe(hote) {
	const t = Math.max(Date.now(), prochain.get(hote) ?? 0);
	prochain.set(hote, t + INTERVALLE_MS);
	await new Promise((r) => setTimeout(r, Math.max(0, t - Date.now())));
}

async function lireTexte(url) {
	const hote = new URL(url).hostname;
	if (refuses.has(hote)) return { statut: 'refuse' };
	await tourDe(hote);
	let r;
	try {
		r = await fetch(url, { headers: { 'user-agent': AGENT_GLANE, accept: 'text/html,text/plain;q=0.9' }, redirect: 'follow', signal: AbortSignal.timeout(DELAI_MS) });
	} catch (e) {
		return { statut: String(e.cause?.code ?? e.name ?? 'reseau') };
	}
	if (REFUS.has(r.status)) refuses.add(hote);
	if (!r.ok) {
		await r.body?.cancel();
		return { statut: r.status };
	}
	const morceaux = [];
	let taille = 0;
	for await (const m of r.body) {
		taille += m.byteLength;
		if (taille > OCTETS_MAX) break;
		morceaux.push(m);
	}
	return { statut: r.status, url: r.url, texte: Buffer.concat(morceaux).toString('utf8') };
}

const robotsEnVol = new Map();
async function permis(url) {
	const hote = new URL(url).hostname;
	const connu = etat.robots[hote];
	if (!(connu && Date.now() - Date.parse(connu.lu) < ROBOTS_DUREE_MS)) {
		if (!robotsEnVol.has(hote)) robotsEnVol.set(hote, lireTexte(`${new URL(url).origin}/robots.txt`));
		const r = await robotsEnVol.get(hote);
		// RFC 9309 : injoignable ou en erreur serveur, rien ce jour-la ; absent, tout est permis.
		if (typeof r.statut !== 'number' || r.statut >= 500 || REFUS.has(r.statut)) return false;
		etat.robots[hote] = { lu: new Date().toISOString(), regles: r.texte ? reglesRobots(r.texte) : [] };
	}
	return robotsPermet(etat.robots[hote].regles, url);
}

async function page(url) {
	if (!(await permis(url))) return { statut: 'robots', liens: [] };
	const r = await lireTexte(url);
	return { statut: r.statut, liens: r.texte ? liensDe(r.texte, r.url) : [] };
}

let plafondAtteint = false;
async function deposer(code, acte) {
	const deja = etat.pdfs[acte.url];
	if (deja && (deja.id || deja.statut === 422 || deja.essais >= ESSAIS_MAX)) return 'connu';
	if (options.sec || plafondAtteint) return 'a-deposer';
	if (!(await permis(acte.url))) return 'robots';
	await tourDe(new URL(acte.url).hostname);
	const r = await fetch(`${options.base}/api/depots`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', authorization: `Bearer ${JETON}`, 'user-agent': AGENT_GLANE },
		body: JSON.stringify({ type: 'acte', url: acte.url, collectivite: code, nature: acte.nature, libelle: acte.libelle })
	});
	const corps = await r.json().catch(() => ({}));
	if (r.status === 401) throw new Error('jeton refuse');
	if (r.status === 429) plafondAtteint = true;
	if (r.status === 201 || r.status === 200) etat.pdfs[acte.url] = { jour, id: corps.id };
	else if (r.status !== 409 && r.status !== 429) etat.pdfs[acte.url] = { jour, statut: r.status, essais: (deja?.essais ?? 0) + 1, erreur: corps.erreur };
	return r.status === 201 ? 'depose' : String(r.status);
}

async function glanerCommune(code, [hote, prefixe]) {
	const sites = [[hote, prefixe]];
	const ligne = { code, site: `${hote}${prefixe}`, accueil: '', page: '', pdfs: 0, actes: 0, deposes: 0, autres: '' };
	const accueil = await page(`https://${hote}${prefixe}/`);
	ligne.accueil = String(accueil.statut);
	const pdfs = new Map();
	const ajouter = (liens) => pdfsDe(liens, sites).forEach((l) => pdfs.has(l.href) || pdfs.set(l.href, l));
	for (const candidate of pagesCandidates(accueil.liens, { sites, ici: `https://${hote}${prefixe}/` })) {
		const p = await page(candidate.href);
		const avant = pdfs.size;
		ajouter(p.liens);
		if (pdfs.size === avant)
			for (const suite of pagesCandidates(p.liens, { sites, ici: candidate.href, max: 2, plancher: 3 })) ajouter((await page(suite.href)).liens);
		if (pdfs.size > avant && !ligne.page) ligne.page = candidate.href;
	}
	ligne.pdfs = pdfs.size;
	const actes = [...pdfs.values()].map(acteDuLien).filter(Boolean);
	ligne.actes = actes.length;
	const issues = {};
	let tentes = 0;
	for (const acte of actes) {
		if (tentes >= Number(options['par-commune'])) break;
		const issue = await deposer(code, acte);
		fs.appendFileSync(detail, `${JSON.stringify({ code, ...acte, issue })}\n`);
		if (issue !== 'connu') tentes++;
		issues[issue] = (issues[issue] ?? 0) + 1;
	}
	ligne.deposes = issues.depose ?? 0;
	ligne.autres = Object.entries(issues)
		.filter(([k]) => k !== 'depose')
		.map(([k, n]) => `${k}:${n}`)
		.join(' ');
	return ligne;
}

const communes = [];
const departements = options.departements === 'tous' ? Object.keys(DEPARTEMENTS) : options.departements.split(',').map((d) => d.trim());
for (const dep of departements) {
	const r = await fetch(`${options.base}/annuaire/insee-${dep}.json`, { headers: { 'user-agent': AGENT_GLANE } });
	if (!r.ok) {
		console.error(`annuaire ${dep} : ${r.status}`);
		continue;
	}
	for (const [code, sites] of Object.entries(await r.json())) communes.push([code, sites[0]]);
}
const max = Number(options['communes-max']);
const file = max > 0 ? communes.slice(0, max) : communes;
const releve = path.join(options.etat, `glane-${jour}.tsv`);
const detail = path.join(options.etat, `glane-${jour}-actes.jsonl`);
if (!fs.existsSync(releve)) fs.writeFileSync(releve, 'code\tsite\taccueil\tpage\tpdfs\tactes\tdeposes\tautres\n');
let suivant = 0;
const totaux = { communes: 0, avecPage: 0, pdfs: 0, actes: 0, deposes: 0 };
async function ouvrier() {
	while (suivant < file.length) {
		const [code, site] = file[suivant++];
		let ligne;
		try {
			ligne = await glanerCommune(code, site);
		} catch (e) {
			if (e.message === 'jeton refuse') throw e;
			ligne = { code, site: site.join(''), accueil: 'erreur', page: '', pdfs: 0, actes: 0, deposes: 0, autres: String(e.message).slice(0, 80) };
		}
		fs.appendFileSync(releve, `${[ligne.code, ligne.site, ligne.accueil, ligne.page, ligne.pdfs, ligne.actes, ligne.deposes, ligne.autres].join('\t')}\n`);
		totaux.communes++;
		totaux.avecPage += ligne.page ? 1 : 0;
		totaux.pdfs += ligne.pdfs;
		totaux.actes += ligne.actes;
		totaux.deposes += ligne.deposes;
		if (totaux.communes % 20 === 0) {
			sauver();
			console.log(JSON.stringify(totaux));
		}
	}
}
await Promise.all(Array.from({ length: Number(options.paralleles) }, ouvrier));
sauver();
console.log(JSON.stringify({ ...totaux, plafondAtteint }));
