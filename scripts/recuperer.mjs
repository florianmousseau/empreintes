#!/usr/bin/env node
// Copie le journal des empreintes de la Box (WebDAV, lecture seule) dans
// `donnees/empreintes/` : les releves et les racines une fois, les preuves
// et `ancrages.json` quand ils ont grandi. Rien d'autre n'est lu.
//
//   STORAGEBOX_UTILISATEUR=... STORAGEBOX_MOTDEPASSE=... node scripts/recuperer.mjs

import fs from 'node:fs';
import path from 'node:path';
import { FICHIER_PUBLIE, IMMUABLE } from '../src/journal.mjs';

const DOSSIER = path.resolve(import.meta.dirname, '..', 'donnees', 'empreintes');
const CHEMIN = '/entrepot/journal/empreintes/';

/** Les fichiers d'une reponse PROPFIND, avec leur taille. */
export function fichiersDe(xml) {
	const fichiers = [];
	for (const bloc of xml.split(/<(?:\w+:)?response[\s>]/i).slice(1)) {
		const href = /<(?:\w+:)?href>([^<]+)</i.exec(bloc)?.[1];
		const taille = /<(?:\w+:)?getcontentlength>(\d+)</i.exec(bloc)?.[1];
		const nom = href ? decodeURIComponent(href).split('/').pop() : '';
		if (FICHIER_PUBLIE.test(nom) && taille !== undefined) fichiers.push({ nom, taille: Number(taille) });
	}
	return fichiers;
}

/** Ce qu'il faut telecharger ; `ancrages.json` change sans changer de taille, un fichier immuable qui en change arrete tout. */
export function aTelecharger(distants, tailleLocale) {
	const liste = [];
	for (const { nom, taille } of distants) {
		const locale = tailleLocale(nom);
		if (locale === taille && nom !== 'ancrages.json') continue;
		if (locale !== null && IMMUABLE.test(nom)) throw new Error(`${nom} a change sur la Box (${locale} -> ${taille} octets) : un releve ne se reecrit jamais`);
		liste.push(nom);
	}
	return liste;
}

async function principal() {
	const { STORAGEBOX_UTILISATEUR: u, STORAGEBOX_MOTDEPASSE: m } = process.env;
	if (!u || !m) throw new Error('STORAGEBOX_UTILISATEUR et STORAGEBOX_MOTDEPASSE sont requis');
	const base = `https://${u}.your-storagebox.de${CHEMIN}`;
	const auth = { authorization: `Basic ${Buffer.from(`${u}:${m}`).toString('base64')}` };
	const liste = await fetch(base, { method: 'PROPFIND', headers: { ...auth, depth: '1' } });
	if (liste.status !== 207) throw new Error(`PROPFIND ${liste.status}`);
	const distants = fichiersDe(await liste.text());
	if (distants.length === 0) throw new Error('aucun fichier du journal sur la Box');
	fs.mkdirSync(DOSSIER, { recursive: true });
	const noms = aTelecharger(distants, (nom) => {
		const f = path.join(DOSSIER, nom);
		return fs.existsSync(f) ? fs.statSync(f).size : null;
	});
	for (const nom of noms) {
		const r = await fetch(base + nom, { headers: auth });
		if (!r.ok) throw new Error(`${nom} : ${r.status}`);
		fs.writeFileSync(path.join(DOSSIER, `${nom}.tmp`), Buffer.from(await r.arrayBuffer()));
		fs.renameSync(path.join(DOSSIER, `${nom}.tmp`), path.join(DOSSIER, nom));
	}
	console.log(`${distants.length} fichiers sur la Box, ${noms.length} copies : ${noms.join(' ') || 'rien de neuf'}`);
}

if (process.argv[1] === import.meta.filename) await principal();
