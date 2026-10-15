#!/usr/bin/env node
// Le filtre de publication des disparitions (D-193), joue PAR L'ENTREPOT sur le
// VPS avant chaque copie (`src/miroir.mjs` la-bas) : il lit les
// `deltas/<jour>.json` prives et n'ecrit dans `donnees/disparus/` du clone que
// ce que `src/disparus.mjs` laisse publier. Rien d'autre ne franchit la porte :
// une adresse refusee n'entre jamais dans l'historique de ce depot public.
//
//   node scripts/disparus.mjs <dossier-des-deltas> <donnees/disparus>

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { publiables } from '../src/disparus.mjs';

const JOUR = /^(\d{4}-\d{2}-\d{2})\.json$/;

const lireJson = (f) => {
	try {
		return JSON.parse(fs.readFileSync(f, 'utf8'));
	} catch {
		return null;
	}
};

/** Ecrit les jours qui portent au moins une entree publiable ; rend les noms ecrits ou changes. */
export function ecrireDisparus(entree, sortie) {
	const ecrits = [];
	const jours = fs.existsSync(entree) ? fs.readdirSync(entree).filter((f) => JOUR.test(f)).sort() : [];
	for (const f of jours) {
		const jour = JOUR.exec(f)[1];
		const evenements = publiables(lireJson(path.join(entree, f))?.evenements);
		if (!evenements.length) continue;
		const contenu = `${JSON.stringify({ jour, evenements }, null, 1)}\n`;
		const cible = path.join(sortie, f);
		if (fs.existsSync(cible) && fs.readFileSync(cible, 'utf8') === contenu) continue;
		fs.mkdirSync(sortie, { recursive: true });
		fs.writeFileSync(cible, contenu);
		ecrits.push(f);
	}
	return ecrits;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
	const [entree, sortie] = process.argv.slice(2);
	if (!entree || !sortie) {
		console.error('usage : node scripts/disparus.mjs <dossier-des-deltas> <donnees/disparus>');
		process.exit(2);
	}
	console.log(JSON.stringify({ ecrits: ecrireDisparus(entree, sortie) }));
}
