import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CLASSES, RETENUES, SOURCES_PUBLIEES, adresseNommante, empreinteDeLAdresse, entreesDe, publiable, publiables, siteDe, sitesDe, texteDeLAdresse } from '../src/disparus.mjs';
import { ecrireDisparus } from '../scripts/disparus.mjs';
import { EVENEMENTS, cheminDuSite, fluxDisparus, nomDuDocument, pageDisparus, pageDisparusDuSite, pageJournal } from '../src/pages.mjs';
import { decider } from '../src/hote.mjs';

const A = 'a'.repeat(64);
const B = 'b'.repeat(64);
const ev = (champs = {}) => ({
	classe: 'disparu',
	source: 'scpi-paref',
	cle: 'scpi-paref/0123456789abcdef0123',
	url: 'https://www.paref-gestion.com/wp-content/uploads/2026/01/rapport-annuel-2025.pdf',
	date: '2026-10-14',
	http: 404,
	avant: { jour: '2026-10-11', sha256: A },
	apres: null,
	...champs
});
const texteDe = (html) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, '');

test('les trois classes passent, reduites a ce qui se publie', () => {
	assert.deepEqual(CLASSES, Object.keys(EVENEMENTS));
	const [e] = publiables([ev({ cle: 'interne', calcule: 'x' })]);
	assert.deepEqual(Object.keys(e), ['classe', 'source', 'url', 'date', 'http', 'avant', 'apres']);
	assert.deepEqual(publiables([ev({ classe: 'remplace', http: null, apres: { jour: '2026-10-14', sha256: B } })])[0].apres, { jour: '2026-10-14', sha256: B });
	assert.equal(publiables([ev({ classe: 'retire', http: 'x', apres: { sha256: 'court' } })])[0].http, null);
	assert.equal(publiables([ev({ classe: 'remplace', apres: { sha256: B } })])[0].apres.jour, null);
	assert.equal(publiables([ev({ avant: { sha256: A } })])[0].avant.jour, null);
	assert.deepEqual(publiables(null), []);
});

test("un evenement sans empreinte d'avant, d'une classe inconnue ou mal forme ne parait pas", () => {
	for (const e of [ev({ avant: null }), ev({ avant: { jour: '2026-10-11', sha256: null } }), ev({ classe: 'supprime' }), ev({ date: 'hier' }), ev({ url: 'pas une adresse' }), ev({ url: 'ftp://x.fr/a.pdf' }), null]) assert.equal(publiable(e), false);
	assert.equal(publiable(ev()), true);
});

test('une source dont le retrait repond a un droit par nature ne parait jamais', () => {
	for (const source of ['dgccrf-injonctions-sanctions', 'amf-sanctions-decisions', 'acpr-sanctions-decisions', 'raa-bouches-du-rhone', 'corpus-truecopy', 'source-nouvelle']) {
		assert.equal(SOURCES_PUBLIEES.has(source), false, source);
		assert.equal(publiable(ev({ source })), false, source);
	}
});

test('une adresse retenue sur un droit ne parait pas, et seule son empreinte est ecrite', () => {
	const e = ev();
	RETENUES.add(empreinteDeLAdresse(e.url));
	try {
		assert.equal(publiable(e), false);
	} finally {
		RETENUES.clear();
	}
	assert.equal(publiable(e), true);
	assert.match(empreinteDeLAdresse(e.url), /^[0-9a-f]{64}$/);
});

test('une adresse qui pourrait nommer une personne ne parait pas', () => {
	for (const url of [
		'https://www.paref-gestion.com/docs/attestation-Jean-Dupont.pdf',
		'https://www.paref-gestion.com/docs/courrier_M._Martin.pdf',
		'https://www.paref-gestion.com/docs/delegation-signature-maingot.pdf',
		'https://www.paref-gestion.com/docs/PETIT%20Catherine.pdf'
	]) {
		assert.equal(adresseNommante(url), true, url);
		assert.equal(publiable(ev({ url })), false, url);
	}
	assert.equal(texteDeLAdresse('https://x.fr/a%ZZb_c.pdf'), 'a%ZZb c.pdf');
	assert.equal(texteDeLAdresse('https://x.fr/Rapport%20annuel_2025.pdf'), 'Rapport annuel 2025.pdf');
	assert.equal(adresseNommante('https://www.paref-gestion.com/docs/rapport-annuel-2025.pdf'), false);
});

test("les entrees : une par classe et adresse, preuve servie seulement, les plus recentes d'abord", () => {
	const jours = [
		{ jour: '2026-10-12', evenements: [ev({ date: '2026-10-12', url: 'https://b.fr/x.pdf' }), ev({ date: '2026-10-12', url: 'https://www.a.fr/y.pdf', classe: 'retire', http: null })] },
		{ jour: '2026-10-14', evenements: [ev(), ev(), ev({ url: 'https://www.a.fr/z.pdf', avant: { jour: '2026-10-11', sha256: B } }), ev({ url: 'https://www.a.fr/w.pdf' })] },
		null
	];
	const entrees = entreesDe(jours, (sha) => sha === A);
	assert.deepEqual(
		entrees.map((e) => [e.date, e.site, nomDuDocument(e.url)]),
		[
			['2026-10-14', 'a.fr', 'w.pdf'],
			['2026-10-14', 'paref-gestion.com', 'rapport-annuel-2025.pdf'],
			['2026-10-12', 'b.fr', 'x.pdf'],
			['2026-10-12', 'a.fr', 'y.pdf']
		]
	);
	assert.deepEqual(sitesDe(entrees), [
		{ site: 'a.fr', n: 2 },
		{ site: 'b.fr', n: 1 },
		{ site: 'paref-gestion.com', n: 1 }
	]);
	assert.equal(entreesDe(jours).length, 5);
	assert.equal(siteDe('https://WWW.Exemple.FR/a'), 'exemple.fr');
	assert.equal(nomDuDocument('https://x.fr/'), 'https://x.fr/');
	assert.equal(nomDuDocument('https://x.fr/a%ZZ.pdf'), 'a%ZZ.pdf');
	assert.equal(nomDuDocument('https://x.fr/a%20b.pdf'), 'a b.pdf');
});

test("le filtre de l'entrepot n'ecrit que les jours publiables, et une seule fois", () => {
	const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'disparus-'));
	const entree = path.join(dossier, 'deltas');
	const sortie = path.join(dossier, 'donnees', 'disparus');
	assert.deepEqual(ecrireDisparus(entree, sortie), []);
	fs.mkdirSync(entree);
	fs.writeFileSync(path.join(entree, '2026-10-13.json'), JSON.stringify({ jour: '2026-10-13', evenements: [ev({ source: 'dgccrf-injonctions-sanctions' })] }));
	fs.writeFileSync(path.join(entree, '2026-10-14.json'), JSON.stringify({ jour: '2026-10-14', calcule: 'x', compte: {}, evenements: [ev(), ev({ url: 'https://x.fr/Jean-Dupont.pdf' })] }));
	fs.writeFileSync(path.join(entree, '2026-10-15.json'), '{ illisible');
	fs.writeFileSync(path.join(entree, 'semaine-2026-W42.json'), '{}');
	assert.deepEqual(ecrireDisparus(entree, sortie), ['2026-10-14.json']);
	const ecrit = JSON.parse(fs.readFileSync(path.join(sortie, '2026-10-14.json'), 'utf8'));
	assert.deepEqual(ecrit, { jour: '2026-10-14', evenements: publiables([ev()]) });
	assert.deepEqual(ecrireDisparus(entree, sortie), []);
	fs.rmSync(dossier, { recursive: true });
});

test('les pages des disparus affichent, lient la preuve et ne disent jamais supprime', () => {
	const entrees = entreesDe([{ evenements: [ev(), ev({ classe: 'retire', http: null, url: 'https://www.a.fr/y.pdf', avant: { sha256: B } }), ev({ classe: 'remplace', http: null, url: 'https://www.a.fr/z.pdf', apres: { sha256: B } })] }]);
	const sites = sitesDe(entrees);
	const page = pageDisparus({ entrees, sites });
	const site = pageDisparusDuSite({ site: 'a.fr', entrees: entrees.filter((e) => e.site === 'a.fr') });
	const vide = pageDisparus({ entrees: [], sites: [] });
	for (const html of [page, site, vide]) {
		const texte = texteDe(html);
		assert.deepEqual(texte.match(/[^\S ][:;?!»]/g), null);
		assert.doesNotMatch(texte, /supprim/i);
		assert.match(html, /<link rel="alternate" type="application\/rss\+xml"[^>]*href="\/disparus.xml">/);
	}
	assert.match(page, /<h2>3 documents, 2 sites<\/h2>/);
	assert.match(page, new RegExp(`href="/verifier\\?empreinte=${A}">Version du 11/10/2026<`));
	assert.match(page, new RegExp(`href="/verifier\\?empreinte=${B}">Version d’avant<`));
	assert.match(page, /<td>Sorti de la liste<\/td><td><a href="\/disparus\/a-fr">a.fr<\/a><\/td>/);
	assert.match(page, /<td class="n">404<\/td>/);
	assert.doesNotMatch(page, /noindex/);
	assert.match(vide, /Aucun document disparu/);
	assert.match(vide, /noindex/);
	assert.match(site, /<h1>a.fr<\/h1>\n<h2>2 documents<\/h2>/);
	assert.match(site, /<link rel="canonical" href="https:\/\/temoinpublic.fr\/disparus\/a-fr">/);
	assert.equal(cheminDuSite('paref-gestion.com'), '/disparus/paref-gestion-com');
	const beaucoup = Array.from({ length: 101 }, (_, i) => ({ ...entrees[0], url: `https://www.a.fr/${i}.pdf` }));
	assert.match(pageDisparus({ entrees: beaucoup, sites: sitesDe(beaucoup) }), /Les 100 plus récents sur 101/);
	assert.match(pageJournal([]), /href="\/disparus">Documents disparus</);
	assert.doesNotMatch(pageJournal([], 'de'), /disparus/);
});

test('le flux RSS porte chaque entree, son lien de preuve et sa date', () => {
	const entrees = entreesDe([{ evenements: [ev(), ev({ classe: 'retire', http: null, url: 'https://www.a.fr/y&z.pdf' })] }]);
	const flux = fluxDisparus(entrees);
	assert.match(flux, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<rss version="2.0">/);
	assert.equal((flux.match(/<item>/g) ?? []).length, 2);
	assert.match(flux, new RegExp(`<link>https://temoinpublic.fr/verifier\\?empreinte=${A}</link>`));
	assert.match(flux, /<pubDate>Wed, 14 Oct 2026 00:00:00 GMT<\/pubDate>/);
	assert.match(flux, /<title>Disparu, paref-gestion.com, rapport-annuel-2025.pdf<\/title>/);
	assert.match(flux, /HTTP 404/);
	assert.match(flux, /y&amp;z.pdf/);
	assert.doesNotMatch(flux, /supprim/i);
	assert.equal((fluxDisparus([]).match(/<item>/g) ?? []).length, 0);
});

test("l'edition allemande renvoie les disparus au francais", () => {
	assert.deepEqual(decider('https://datumszeuge.de/disparus/a-fr'), { action: 'redirection', vers: 'https://temoinpublic.fr/disparus/a-fr' });
	assert.deepEqual(decider('https://datumszeuge.de/disparus.xml'), { action: 'redirection', vers: 'https://temoinpublic.fr/disparus.xml' });
	assert.deepEqual(decider('https://temoinpublic.fr/disparus'), { action: 'suivant' });
});
