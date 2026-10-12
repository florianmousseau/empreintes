#!/usr/bin/env node
// Ecrit la table des sites officiels des collectivites dans `dist/annuaire/`,
// le nom de chaque commune dans `dist/annuaire/communes/` et l'index des
// hotes vers leur commune dans `dist/annuaire/hotes/`, a la
// publication, apres la construction (D-165). Un export illisible ou
// tronque fait echouer le script : la publication continue sans la table, et
// tout acte reste « declaree » plutot que rattache sur une liste douteuse.
//
//   node scripts/annuaire.mjs

import fs from 'node:fs';
import path from 'node:path';
import { API_ANNUAIRE, fragmentDeLHote, fragments, nomsDesCommunes, tableDesHotes, tableDesSites } from '../src/annuaire.mjs';

const SORTIE = path.resolve(import.meta.dirname, '..', 'dist', 'annuaire');

async function lireExport() {
	const r = await fetch(API_ANNUAIRE, { signal: AbortSignal.timeout(120000) });
	if (!r.ok) throw new Error(`annuaire : l'export a repondu ${r.status}`);
	return r.json();
}

const fiches = await lireExport();
const table = tableDesSites(fiches);
const parts = fragments(table);
const noms = fragments(nomsDesCommunes(fiches));
fs.rmSync(SORTIE, { recursive: true, force: true });
fs.mkdirSync(path.join(SORTIE, 'communes'), { recursive: true });
fs.mkdirSync(path.join(SORTIE, 'hotes'), { recursive: true });
for (const [nom, part] of Object.entries(parts)) fs.writeFileSync(path.join(SORTIE, `${nom}.json`), JSON.stringify(part));
for (const [nom, part] of Object.entries(noms)) fs.writeFileSync(path.join(SORTIE, 'communes', `${nom}.json`), JSON.stringify(part));
const hotes = {};
for (const [hote, entrees] of Object.entries(tableDesHotes(table))) (hotes[fragmentDeLHote(hote)] ??= {})[hote] = entrees;
for (const [nom, part] of Object.entries(hotes)) fs.writeFileSync(path.join(SORTIE, 'hotes', `${nom}.json`), JSON.stringify(part));
const codes = Object.keys(table).length;
fs.writeFileSync(path.join(SORTIE, 'etat.json'), `${JSON.stringify({ codes, fragments: Object.keys(parts).length, construit: new Date().toISOString() })}\n`);
console.log(`annuaire : ${codes} codes, ${Object.keys(parts).length} fragments`);
