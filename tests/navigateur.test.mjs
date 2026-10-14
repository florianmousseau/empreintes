// Ce que les scripts du navigateur montrent au deposant : des phrases, jamais les codes de l'API.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const DETAILS_DU_FORMULAIRE = [
	'url illisible',
	'http ou https seulement',
	'adresse privee, locale ou reservee',
	'nom d hote non public',
	'hote sans adresse',
	'sha256 : 64 caracteres hexadecimaux',
	'collectivite : code commune INSEE (5 caracteres) ou SIREN (9 chiffres)',
	'libelle : aucun nom de personne'
];

const echapperPourRegExp = (texte) => texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/*
 * 2026-10-14, /deposer : « pas une adresse » dans le champ du lien rendait
 * « url refusee / url illisible », le code de l'API sans accent ni titre.
 */
test('un refus 400 porte un titre et des motifs lisibles, dans les deux langues', () => {
	const textes = readFileSync(new URL('../public/textes.js', import.meta.url), 'utf8');
	assert.match(textes, /400: \{ fr: '[^']+', de: '[^']+' \}/);
	for (const detail of DETAILS_DU_FORMULAIRE) assert.match(textes, new RegExp(`'${echapperPourRegExp(detail)}': \\{ fr: '[^']+', de: '[^']+' \\}`), detail);
	assert.match(readFileSync(new URL('../public/deposer.js', import.meta.url), 'utf8'), /t\.motifs\[d\] \?\? d/);
});
