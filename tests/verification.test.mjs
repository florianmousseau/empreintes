// Ce que la page de verification montre : un resultat par document date, jamais deux.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/*
 * 2026-10-14, /verifier : choisir le fichier lance la verification, et un clic
 * sur « Vérifier » pendant qu'elle tourne en lancait une seconde ; les deux
 * ajoutaient leurs lignes au meme resultat, affiche en double.
 */
test('la verification ecrit son resultat d un seul tenant', () => {
	const source = readFileSync(new URL('../public/verifier.js', import.meta.url), 'utf8');
	assert.ok(!/innerHTML \+=/.test(source), 'aucun ajout au resultat en cours de route');
});
