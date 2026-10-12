#!/usr/bin/env node
// Ecrit la table des sites officiels des collectivites dans `dist/annuaire/`,
// a la publication, apres la construction (D-165). Un export illisible ou
// tronque fait echouer le script : la publication continue sans la table, et
// tout acte reste « declaree » plutot que rattache sur une liste douteuse.
//
//   node scripts/annuaire.mjs

import fs from 'node:fs';
import path from 'node:path';
import { API_ANNUAIRE, fragments, tableDesSites } from '../src/annuaire.mjs';

const SORTIE = path.resolve(import.meta.dirname, '..', 'dist', 'annuaire');

async function lireExport() {
	const r = await fetch(API_ANNUAIRE, { signal: AbortSignal.timeout(120000) });
	if (!r.ok) throw new Error(`annuaire : l'export a repondu ${r.status}`);
	return r.json();
}

const table = tableDesSites(await lireExport());
const parts = fragments(table);
fs.rmSync(SORTIE, { recursive: true, force: true });
fs.mkdirSync(SORTIE, { recursive: true });
for (const [nom, part] of Object.entries(parts)) fs.writeFileSync(path.join(SORTIE, `${nom}.json`), JSON.stringify(part));
const codes = Object.keys(table).length;
fs.writeFileSync(path.join(SORTIE, 'etat.json'), `${JSON.stringify({ codes, fragments: Object.keys(parts).length, construit: new Date().toISOString() })}\n`);
console.log(`annuaire : ${codes} codes, ${Object.keys(parts).length} fragments`);
