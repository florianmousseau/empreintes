import test from 'node:test';
import assert from 'node:assert/strict';
import { ancrageDe, dateHeure, echapper, pageAccueil, pageVerifier } from '../src/pages.mjs';

const t = { id: '20261012T101314Z', instant: '2026-10-12T10:13:14Z', objets: 2018, racine: 'f'.repeat(64), ots: 'bitcoin', bloc: 971045, fichiers: ['20261012T101314Z.json', '20261012T101314Z.racine.ots'] };
const pages = [pageAccueil([t, { ...t, id: '20261012T121314Z', ots: 'calendrier', bloc: null }]), pageVerifier(), pageAccueil([])];
const texteDe = (html) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, '');

test('aucun signe double ne suit une espace ordinaire dans le texte affiche', () => {
	for (const html of pages) {
		const texte = texteDe(html);
		assert.ok(texte.length > 40, 'le detecteur lit du texte');
		assert.deepEqual(texte.match(/[^\S ][:;?!»]/g), null);
	}
	assert.match(texteDe('<p>a :</p>'), / :/, 'le detecteur voit une espace ordinaire');
});

test("le nom de l'editeur est un lien vers son site", () => {
	for (const html of pages) assert.match(html, /<a href="https:\/\/florianmousseau.com">Florian Mousseau<\/a>/);
});

test("l'accueil affiche le dernier tour, son ancrage et ses fichiers", () => {
	assert.match(pages[0], /Bitcoin, bloc 971045/);
	assert.match(pages[0], /en attente du bloc/);
	assert.match(pages[0], /href="\/empreintes\/20261012T101314Z.racine.ots">.ots</);
	assert.match(pages[2], /Aucun tour publié/);
});

test('les dates, les ancrages et les textes se rendent sans surprise', () => {
	assert.equal(dateHeure('2026-10-12T10:13:14Z'), '12/10/2026 10:13 UTC');
	assert.equal(ancrageDe({ ots: 'erreur' }), 'erreur');
	assert.equal(ancrageDe({ ots: null }), 'aucun');
	assert.equal(echapper('<a href="x">\'&'), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
});
