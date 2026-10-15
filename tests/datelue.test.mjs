import test from 'node:test';
import assert from 'node:assert/strict';
import { dateLue } from '../src/datelue.mjs';

const lire = (objet, url = null, jour = '2026-10-15') => dateLue({ objet, url, jour });

test('la date se lit dans le libelle, en toutes lettres ou en chiffres, la premiere qui tient', () => {
	assert.deepEqual(lire('Procès-verbal du conseil municipal du 12 février 2026'), { date: '2026-02-12', precision: 'jour', dans: 'libelle' });
	assert.equal(lire('Séance du 1er mars 2025').date, '2025-03-01');
	assert.equal(lire('REUNION DU CONSEIL MUNICIPAL 25 Aout 2023').date, '2023-08-25');
	assert.equal(lire('PV 30 09 2024').date, '2024-09-30');
	assert.equal(lire('Cm du 02/12/2022').date, '2022-12-02');
	assert.equal(lire('2025 03 27_PV Conseil municipal').date, '2025-03-27');
	assert.equal(lire('PV du 9 juillet 2026 - Publié le 9 octobre 2026').date, '2026-07-09');
	assert.equal(lire('PV-CM-du-09-07-26').date, '2026-07-09');
	assert.equal(lire('Liste CM 15122025').date, '2025-12-15');
	assert.equal(lire('Liste des délibérations', 'https://x.fr/20260416_liste_deliberations.pdf').date, '2026-04-16');
	assert.equal(lire('Scan_26090209290'), null);
});

test('a defaut du libelle, le nom du fichier ; a defaut du jour, le mois', () => {
	assert.deepEqual(lire('PROCES VERBAL', 'https://limalonges.fr/Files/PV%20du%2020%20avril%202026.pdf'), { date: '2026-04-20', precision: 'jour', dans: 'fichier' });
	assert.deepEqual(lire('PV juin 2024', 'https://x.fr/pv.pdf'), { date: '2024-06', precision: 'mois', dans: 'libelle' });
	assert.deepEqual(lire(null, 'https://x.fr/PV-CM-FEVRIER-2026.pdf'), { date: '2026-02', precision: 'mois', dans: 'fichier' });
	assert.equal(lire('Budget', 'https://x.fr/100%.pdf'), null);
	assert.equal(lire('Budget', 'pas une adresse'), null);
	assert.equal(lire(null, null), null);
});

test("rien ne se devine : ni un numero d'acte, ni une date impossible, future, d'avant 2000 ou trop lointaine sur deux chiffres", () => {
	for (const objet of [
		'Arrêté n°2026-03',
		'DELIBERATION 2026 14 - FIXATION INDEMNITES',
		'D2026-5-1 Elections sénatoriales',
		'ARRETE N° 002 2024',
		'PV du 31 02 2026',
		'PV du 20 octobre 2026',
		'PV du 12 mars 1998',
		'26-02-17-Compte-rendu',
		'PV du 26 janvier',
		'PV décembre 2026',
		'PV mars 1999'
	])
		assert.equal(lire(objet), null, objet);
});
