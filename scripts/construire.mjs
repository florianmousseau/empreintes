#!/usr/bin/env node
// Construit `dist/` depuis `donnees/empreintes/` : les fichiers du journal tels
// quels, la liste des tours, l'index des empreintes et les deux pages.
//
//   node scripts/construire.mjs

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { FICHIER_PUBLIE, ID_DE_TOUR, indexDesEmpreintes, resumeDe } from '../src/journal.mjs';
import { pageAccueil, pageDeposer, pageIntrouvable, pageJournal, pageVerifier } from '../src/pages.mjs';

const RACINE = path.resolve(import.meta.dirname, '..');
const DONNEES = path.join(RACINE, 'donnees', 'empreintes');
const DIST = path.join(RACINE, 'dist');

const lireJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

function commitServi() {
	try {
		return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: RACINE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
	} catch {
		return process.env.GITHUB_SHA ?? 'inconnu';
	}
}

const ecrire = (relatif, contenu) => {
	const f = path.join(DIST, relatif);
	fs.mkdirSync(path.dirname(f), { recursive: true });
	fs.writeFileSync(f, contenu);
};

const fichiers = fs.readdirSync(DONNEES).filter((f) => FICHIER_PUBLIE.test(f));
const ids = fichiers.filter((f) => f.endsWith('.json') && ID_DE_TOUR.test(f.slice(0, -5))).map((f) => f.slice(0, -5)).sort();
const ancrages = fs.existsSync(path.join(DONNEES, 'ancrages.json')) ? lireJson(path.join(DONNEES, 'ancrages.json')) : { tours: {} };
const releves = ids.map((id) => lireJson(path.join(DONNEES, `${id}.json`)));
const tours = releves.map((r) => resumeDe(r, ancrages.tours?.[r.id], fichiers));

fs.rmSync(DIST, { recursive: true, force: true });
for (const f of fichiers) ecrire(path.join('empreintes', f), fs.readFileSync(path.join(DONNEES, f)));
for (const [prefixe, part] of Object.entries(indexDesEmpreintes(releves))) ecrire(`index/${prefixe}.json`, JSON.stringify(part));
const copie = fs.existsSync(path.join(RACINE, 'donnees', 'copie.json')) ? lireJson(path.join(RACINE, 'donnees', 'copie.json')) : null;
ecrire('tours.json', `${JSON.stringify({ copie, tours }, null, 1)}\n`);
ecrire('version.json', `${JSON.stringify({ commit: commitServi(), construit: new Date().toISOString() })}\n`);
ecrire('index.html', pageAccueil(tours));
ecrire('verifier.html', pageVerifier());
ecrire('journal.html', pageJournal(tours));
ecrire('404.html', pageIntrouvable());
ecrire('deposer.html', pageDeposer());
for (const m of ['chaine.mjs', 'depot.mjs']) ecrire(m, fs.readFileSync(path.join(RACINE, 'src', m)));
for (const f of fs.readdirSync(path.join(RACINE, 'public'))) ecrire(f, fs.readFileSync(path.join(RACINE, 'public', f)));
console.log(`${tours.length} tours, ${fichiers.length} fichiers du journal, dist/ ecrit`);
