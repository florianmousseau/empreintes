import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTES, ancrageDe, dateHeure, echapper, pageAccueil, pageDeposer, pageJournal, pageVerifier } from '../src/pages.mjs';

const t = { id: '20261012T101314Z', instant: '2026-10-12T10:13:14Z', objets: 2018, racine: 'f'.repeat(64), ots: 'bitcoin', bloc: 971045, fichiers: ['20261012T101314Z.json', '20261012T101314Z.racine.ots'] };
const pages = [pageJournal([t, { ...t, id: '20261012T121314Z', ots: 'calendrier', bloc: null }]), pageVerifier(), pageJournal([]), pageDeposer(), pageAccueil([t]), pageAccueil([])];
const texteDe = (html) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, '');

test('aucun signe double ne suit une espace ordinaire dans le texte affiche', () => {
	for (const html of pages) {
		const texte = texteDe(html);
		assert.ok(texte.length > 40, 'le detecteur lit du texte');
		assert.deepEqual(texte.match(/[^\S\u00A0][:;?!»]/g), null);
	}
	assert.match(texteDe('<p>a :</p>'), / :/, 'le detecteur voit une espace ordinaire');
});

test("le nom de l'editeur est un lien vers son site", () => {
	for (const html of pages) assert.match(html, /<a href="https:\/\/florianmousseau.com">Florian Mousseau<\/a>/);
});

test("le journal affiche le dernier tour, son ancrage et ses fichiers", () => {
	assert.match(pages[0], /Bitcoin, bloc 971045/);
	assert.match(pages[0], /en cours d’inscription dans Bitcoin/);
	assert.match(pages[0], /href="\/empreintes\/20261012T101314Z.racine.ots">.ots</);
	assert.match(pages[2], /Aucun tour publié/);
});

test('les dates, les ancrages et les textes se rendent sans surprise', () => {
	assert.equal(dateHeure('2026-10-12T10:13:14Z'), '12/10/2026 10:13\u00A0UTC');
	assert.equal(ancrageDe({ ots: 'erreur' }), 'erreur');
	assert.equal(ancrageDe({ ots: null }), 'aucun');
	assert.equal(echapper('<a href="x">\'&'), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
});

test("l'accueil dit a quoi sert le service et mene aux deux gestes, sans le vocabulaire du journal", () => {
	const accueil = pages[4];
	assert.match(accueil, /<h1>Prouvez qu’un document existait à une date, sans modification.<\/h1>/);
	assert.match(accueil, /href="\/deposer">Dater un document</);
	assert.match(accueil, /2\u00A0018 documents publics déjà datés/);
	const texte = texteDe(accueil.slice(accueil.indexOf('<main>')));
	for (const mot of ['racine', 'tour', 'ancrage', 'bloc', '.ots', 'miroir', 'SHA']) assert.ok(!texte.includes(mot), mot);
});

test('un acte porte un seul nom sur toutes les pages', () => {
	for (const html of pages) {
		for (const acte of Object.values(ACTES)) {
			for (const m of html.matchAll(new RegExp(`href="${acte.chemin}"[^>]*>([^<]+)<`, 'g'))) assert.equal(m[1], acte.nom);
		}
	}
});

test('le choix du document est en francais, et les autres voies sont repliees', () => {
	for (const html of [pages[1], pages[3]]) {
		assert.match(html, /<label class="bouton" for="fichier">Choisir le document<\/label>/);
		assert.match(html, /<details>\n<summary>Pas le fichier sous la main\u00A0\?<\/summary>/);
	}
});
