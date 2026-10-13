#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Florian Mousseau. Ce fichier seul est sous licence MIT (LICENSES/MIT.txt).
// Verifie un fichier, ou toute la chaine, contre le journal publie.
//
//   node scripts/verifier.mjs <fichier|sha256> [--site <adresse>]
//   node scripts/verifier.mjs --chaine [--site <adresse>]
//
// Sortie 0 : servi tel quel (ou chaine intacte) ; 1 : inconnu ou rompu ; 2 : usage.

import fs from 'node:fs';
import { sha256, placeDuFichier, verifierChaine } from '../src/chaine.mjs';

const SITE = 'https://temoinpublic.fr';

async function lire(site, chemin) {
	const r = await fetch(new URL(chemin, site));
	if (!r.ok) throw new Error(`${chemin} : ${r.status}`);
	return r.json();
}

/** Les constats d'une empreinte : une ligne par objet du journal qui l'a portee. */
export async function verifierEmpreinte(site, empreinte) {
	const r = await fetch(new URL(`/index/${empreinte.slice(0, 2)}.json`, site));
	const vus = r.ok ? ((await r.json())[empreinte] ?? []) : [];
	const constats = [];
	for (const vu of vus) {
		const releve = await lire(site, `/empreintes/${vu.premier}.json`);
		const place = await placeDuFichier(releve, empreinte);
		constats.push({ ...vu, racine: releve.racine, ok: Boolean(place?.ok) });
	}
	return constats;
}

async function principal(args) {
	const i = args.indexOf('--site');
	const site = i >= 0 ? args.splice(i, 2)[1] : SITE;
	const [cible] = args;
	if (!cible) {
		console.error('usage : node scripts/verifier.mjs <fichier|sha256> | --chaine [--site <adresse>]');
		return 2;
	}
	if (cible === '--chaine') {
		const { tours } = await lire(site, '/tours.json');
		const v = await verifierChaine(
			tours.map((t) => t.id),
			(id) => lire(site, `/empreintes/${id}.json`)
		);
		console.log(JSON.stringify(v, null, 1));
		return v.ok ? 0 : 1;
	}
	const empreinte = /^[0-9a-f]{64}$/i.test(cible) && !fs.existsSync(cible) ? cible.toLowerCase() : await sha256(fs.readFileSync(cible));
	const constats = await verifierEmpreinte(site, empreinte);
	console.log(JSON.stringify({ empreinte, constats }, null, 1));
	return constats.some((c) => c.ok) ? 0 : 1;
}

if (process.argv[1] === import.meta.filename) process.exit(await principal(process.argv.slice(2)));
