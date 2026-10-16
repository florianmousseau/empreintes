// Le cahier imprime du journal (D-201, point 2) : un PDF lisible par tout lecteur,
// le meme a chaque construction, qui porte chaque racine du trimestre.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { LIGNES_PAR_PAGE, cahierPdf, enGroupes, toursDuTrimestre, trimestreDe } from '../src/cahier.mjs';
import { empreintesDuSignataire, numeroDuCahier, toursDuDossier } from '../scripts/cahier.mjs';

const racine = (i) => i.toString(16).padStart(64, '0');
const tours = (n, debut = Date.UTC(2026, 9, 11)) => Array.from({ length: n }, (_, i) => ({ id: new Date(debut + i * 3600e3).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''), racine: racine(i + 1) }));
const latin1 = (octets) => Buffer.from(octets).toString('latin1');

test('le trimestre d un tour, les tours d un trimestre, la racine en huit groupes', () => {
	assert.equal(trimestreDe('20261011T041935Z'), '2026-T4');
	assert.equal(trimestreDe('20270331T235959Z'), '2027-T1');
	assert.equal(trimestreDe('20270401T000000Z'), '2027-T2');
	const t = [{ id: '20270101T000000Z' }, { id: '20261231T235959Z' }, { id: '20261001T000000Z' }];
	assert.deepEqual(toursDuTrimestre(t, '2026-T4').map((x) => x.id), ['20261001T000000Z', '20261231T235959Z']);
	assert.equal(enGroupes('ab'.repeat(32)), Array(8).fill('abababab').join(' '));
});

test('un PDF valide : chaque objet a sa place dans la table, une page de couverture puis 54 tours par page', () => {
	const pdf = latin1(cahierPdf({ numero: 1, trimestre: '2026-T4', tours: tours(LIGNES_PAR_PAGE + 1) }));
	assert.ok(pdf.startsWith('%PDF-1.4\n'));
	assert.ok(pdf.endsWith('%%EOF\n'));
	const xref = Number(/startxref\n(\d+)/.exec(pdf)[1]);
	assert.equal(pdf.slice(xref, xref + 4), 'xref');
	const positions = [...pdf.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
	positions.forEach((p, i) => assert.equal(pdf.slice(p, p + `${i + 1} 0 obj`.length), `${i + 1} 0 obj`));
	assert.match(pdf, /\/Type \/Pages \/Count 3 /);
	for (const m of pdf.matchAll(/<< \/Length (\d+) >>\nstream\n/g)) assert.equal(pdf.slice(m.index + m[0].length + Number(m[1]), m.index + m[0].length + Number(m[1]) + 10), '\nendstream');
	assert.match(pdf, /page 3 sur 3/);
});

test('chaque racine du trimestre est imprimee, et deux constructions rendent les memes octets', () => {
	const t = tours(40);
	const a = cahierPdf({ numero: 1, trimestre: '2026-T4', tours: t });
	assert.deepEqual(a, cahierPdf({ numero: 1, trimestre: '2026-T4', tours: t }));
	const pdf = latin1(a);
	for (const x of t) assert.ok(pdf.includes(enGroupes(x.racine)), x.id);
	assert.match(pdf, /\(11\/10\/2026 00:00:00 {2}00000000 /);
	assert.match(pdf, /Du 11\/10\/2026 au 12\/10\/2026 : 40 tours\./);
});

test('la couverture : numero, trimestre, ISSN quand il existe, empreintes du signataire, accents en WinAnsi', () => {
	const pdf = latin1(cahierPdf({ numero: 2, trimestre: '2027-T1', tours: tours(2, Date.UTC(2027, 0, 1)), empreintes: [{ nom: 'Clé (test)', sha256: 'c'.repeat(64) }], issn: '1234-5678' }));
	assert.match(pdf, /Cahier 2, 1er trimestre 2027/);
	assert.match(pdf, /ISSN 1234-5678/);
	assert.ok(pdf.includes('(Cl\xe9 \\(test\\))'), 'e accent en un octet, parentheses echappees');
	assert.ok(pdf.includes('T\xe9moin public'));
	assert.doesNotMatch(latin1(cahierPdf({ numero: 1, trimestre: '2026-T4', tours: tours(1) })), /ISSN/);
	assert.ok(latin1(cahierPdf({ numero: 1, trimestre: '2026-T4', tours: tours(1), empreintes: [{ nom: 'l’autre', sha256: 'd'.repeat(64) }] })).includes('(l\x92autre)'));
	assert.throws(() => cahierPdf({ numero: 1, trimestre: '2026-T4', tours: tours(1), empreintes: [{ nom: '→', sha256: 'd'.repeat(64) }] }), /hors WinAnsi/);
	assert.throws(() => cahierPdf({ numero: 1, trimestre: '2026-T4', tours: [] }), /aucun tour/);
});

test('le script : le cahier 1 est le 4e trimestre 2026, les tours se lisent dans le journal, le certificat en couverture', () => {
	assert.equal(numeroDuCahier('2026-T4'), 1);
	assert.equal(numeroDuCahier('2027-T1'), 2);
	assert.equal(numeroDuCahier('2028-T4'), 9);
	const lus = toursDuDossier(path.join(import.meta.dirname, '..', 'donnees', 'empreintes'));
	assert.ok(lus.length >= 24);
	assert.ok(lus.every((t) => /^[0-9a-f]{64}$/.test(t.racine)));
	assert.ok(lus.some((t) => t.id === '20261011T041935Z'));
	assert.deepEqual(empreintesDuSignataire()[0], { nom: 'Certificat du journal (ES256), sha256', sha256: '5263feba5fc71c4725c93328c0c75a94fc4e1b632bb9ff01574239551ab34b80' });
});
