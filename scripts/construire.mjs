#!/usr/bin/env node
// Construit `dist/` depuis `donnees/empreintes/` : les fichiers du journal tels
// quels, la liste des tours, l'index des empreintes, les pages francaises a la
// racine et les pages allemandes sous `de/`.
//
//   node scripts/construire.mjs

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { FICHIER_PUBLIE, ID_DE_TOUR, PREUVE_PUBLIEE, indexDesEmpreintes, resumeDe } from '../src/journal.mjs';
import { pageAccueil, pageActe, pageDeposer, pageDocumentation, pageIntrouvable, pageJournal, pageMentions, pagePreuve, pageRoles, pageSections, pageVerifier, planDuSite, robots } from '../src/pages.mjs';
import { EDITIONS, dossierDe, planDe } from '../src/edition.mjs';

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
// Les attestations des listes publiques et les preuves de leurs objets (D-162), poussees par l'entrepot.
const PAR_URL = path.join(RACINE, 'donnees', 'attestations', 'par-url.json');
if (fs.existsSync(PAR_URL)) ecrire('attestations/par-url.json', fs.readFileSync(PAR_URL));
const PREUVES = path.join(RACINE, 'donnees', 'preuves');
const preuves = fs.existsSync(PREUVES) ? fs.readdirSync(PREUVES).filter((f) => PREUVE_PUBLIEE.test(f)) : [];
for (const f of preuves) ecrire(`preuves/${f}`, fs.readFileSync(path.join(PREUVES, f)));
const copie = fs.existsSync(path.join(RACINE, 'donnees', 'copie.json')) ? lireJson(path.join(RACINE, 'donnees', 'copie.json')) : null;
ecrire('tours.json', `${JSON.stringify({ copie, tours }, null, 1)}\n`);
ecrire('version.json', `${JSON.stringify({ commit: commitServi(), construit: new Date().toISOString() })}\n`);
for (const [langue, e] of Object.entries(EDITIONS)) {
	const dans = (f, contenu) => ecrire(`${dossierDe(langue)}${f}`, contenu);
	dans('index.html', pageAccueil(tours, langue));
	dans(`${e.actes.verifier.chemin.slice(1)}.html`, pageVerifier(langue));
	dans(`${e.actes.journal.chemin.slice(1)}.html`, pageJournal(tours, langue));
	dans('404.html', pageIntrouvable(langue));
	dans(`${e.actes.documentation.chemin.slice(1)}.html`, pageDocumentation(langue));
	dans(`${e.actes.dater.chemin.slice(1)}.html`, pageDeposer(langue));
	dans(`${e.actes.mentions.chemin.slice(1)}.html`, pageMentions(langue));
	dans(`${e.actes.preuve.chemin.slice(1)}.html`, pagePreuve(tours, undefined, langue));
	dans(`${e.actes.pratiques.chemin.slice(1)}.html`, pageSections('pratiques', langue));
	dans(`${e.actes.conditions.chemin.slice(1)}.html`, pageSections('conditions', langue));
	dans(`${e.actes.roles.chemin.slice(1)}.html`, pageRoles(langue));
	dans('sitemap.xml', planDuSite(planDe(langue), langue));
	dans('robots.txt', robots(langue));
	dans('llms.txt', e.llms);
}
ecrire('acte.html', pageActe());
for (const m of ['chaine.mjs', 'depot.mjs', 'acte.mjs', 'personne.mjs', 'annuaire.mjs', 'affichage.mjs']) ecrire(m, fs.readFileSync(path.join(RACINE, 'src', m)));
for (const f of fs.readdirSync(path.join(RACINE, 'public'))) ecrire(f, fs.readFileSync(path.join(RACINE, 'public', f)));
console.log(`${tours.length} tours, ${fichiers.length} fichiers du journal, ${preuves.length} preuves, dist/ ecrit`);
