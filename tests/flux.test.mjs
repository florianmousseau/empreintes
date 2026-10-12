import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LECTURES_PAR_JOUR, empreinteDEntree, idDArticle, lireFlux, planDuJour, repriseApres } from '../src/flux.mjs';

const donnee = (f) => readFileSync(new URL(`./donnees/${f}`, import.meta.url), 'utf8');
const SELFSTORE = donnee('selfstore-rss.xml');
const ATOM = donnee('atom-rfc4287.xml');

test('le flux de selfstore.dev se lit en RSS 2.0 : 13 articles, lien, guid, date, resume decode', () => {
	const f = lireFlux(SELFSTORE, 'https://selfstore.dev/rss.xml');
	assert.equal(f.format, 'rss');
	assert.equal(f.titre, 'selfstore blog');
	assert.equal(f.entrees.length, 13);
	assert.equal(f.ignorees, 0);
	const [premier] = f.entrees;
	assert.equal(premier.id, 'https://selfstore.dev/blog/testing-a-local-first-app/');
	assert.equal(premier.lien, premier.id);
	assert.equal(premier.publie, '2026-10-07T00:00:00.000Z');
	assert.equal(premier.modifie, null, 'selfstore ne publie pas de date de mise a jour');
	assert.match(premier.resume, /^A server app's test suite/);
	assert.ok(f.entrees.every((e) => e.lien.startsWith('https://selfstore.dev/blog/')));
});

test("l'exemple Atom de la RFC 4287 se lit : id, lien alternate (pas l'enclosure), dates, contenu", () => {
	const f = lireFlux(ATOM, 'http://example.org/feed.atom');
	assert.equal(f.format, 'atom');
	assert.equal(f.titre, 'dive into mark');
	assert.deepEqual(
		{ ...f.entrees[0], contenu: undefined },
		{ id: 'tag:example.org,2003:3.2397', lien: 'http://example.org/2005/04/02/atom', titre: 'Atom draft-07 snapshot', resume: null, contenu: undefined, publie: '2003-12-13T12:29:29.000Z', modifie: '2005-07-31T12:29:29.000Z' }
	);
	assert.match(f.entrees[0].contenu, /The Atom draft is finished/);
});

const rss = (items) => `<?xml version="1.0"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>T &amp; co</title>${items}</channel></rss>`;

test('CDATA, entites, liens relatifs, doublons et entrees sans identite', () => {
	const f = lireFlux(
		rss(`<!-- <item><title>commentaire</title></item> -->
<item><title><![CDATA[A </title> & B]]></title><link>/a/</link><content:encoded><![CDATA[<p>x</p>]]></content:encoded><atom:updated>2026-10-12T08:00:00Z</atom:updated></item>
<item><title>A &#233;t&#xE9; &unknown;</title><guid isPermaLink="false">g-2</guid><link>mailto:x@y.fr</link><pubDate>pas une date</pubDate></item>
<item><guid>g-2</guid><link>https://x.fr/doublon</link></item>
<item><title>sans identite</title></item>
<item/>`),
		'https://x.fr/rss.xml'
	);
	assert.equal(f.titre, 'T & co');
	assert.deepEqual(
		f.entrees.map((e) => [e.id, e.lien, e.titre, e.contenu, e.publie, e.modifie]),
		[
			['https://x.fr/a/', 'https://x.fr/a/', 'A </title> & B', '<p>x</p>', null, '2026-10-12T08:00:00.000Z'],
			['g-2', null, 'A été &unknown;', null, null, null]
		]
	);
	assert.equal(f.ignorees, 3);
});

test("un document qui n'est ni RSS 2.0 ni Atom 1.0, ou mal ferme, echoue au lieu d'etre devine", () => {
	for (const [texte, motif] of [
		['<html><body>moved</body></html>', /ni RSS 2.0 ni Atom 1.0/],
		['<rss version="0.91"><channel></channel></rss>', /RSS 2.0 seulement/],
		["<feed xmlns='http://purl.org/atom/ns#'></feed>", /Atom 1.0 sans son espace de noms/],
		[rss('<item><title>x</title>'), /item non ferme/],
		[rss('<item><title><![CDATA[x</title></item>'), /non fermee/],
		[rss('<item><title>x</title></item><!-- '), /section non fermee/],
		['<rss version="2.0"', /balise rss non fermee/],
		[null, /ni RSS/]
	])
		assert.throws(() => lireFlux(texte, 'https://x.fr/'), motif);
	assert.deepEqual(lireFlux('<rss version="2.0"></rss>', 'https://x.fr/').entrees, []);
	assert.equal(lireFlux(rss('<item><guid>g</guid><link>http://[x</link></item>'), 'https://x.fr/').entrees[0].lien, null);
	const atomSansLien = lireFlux('<feed xmlns="http://www.w3.org/2005/Atom"><entry><id>i</id><link rel="self" href="/s"/></entry></feed>', 'https://x.fr/');
	assert.deepEqual([atomSansLien.titre, atomSansLien.entrees[0].lien], [null, null]);
});

test("l'empreinte d'une entree suit son contenu dans le flux ; l'identifiant d'article ne depend que de son identite", async () => {
	const [e] = lireFlux(SELFSTORE, 'https://selfstore.dev/rss.xml').entrees;
	assert.match(await empreinteDEntree(e), /^[0-9a-f]{64}$/);
	assert.notEqual(await empreinteDEntree(e), await empreinteDEntree({ ...e, resume: `${e.resume} Corrige.` }));
	assert.equal(await idDArticle(e), await idDArticle({ ...e, titre: 'autre titre' }));
	assert.notEqual(await idDArticle(e), await idDArticle({ ...e, id: 'autre' }));
});

test('le plan du jour : nouvelles et modifiees le jour meme, relecture hebdomadaire, un essai par jour, plafond', () => {
	const jour = '2026-10-12';
	const e = (id, empreinte = 'e') => ({ id, lien: `https://x.fr/${id}`, empreinte });
	const plan = planDuJour({
		jour,
		entrees: [e('neuve'), e('modifiee', 'e2'), e('vue-hier'), e('semaine'), e('vieille'), e('essayee'), { id: 'sans-lien', lien: null, empreinte: 'e' }, e('echec')],
		connus: {
			modifiee: { empreinte: 'e', essaye: '2026-10-11', lu: '2026-10-11' },
			'vue-hier': { empreinte: 'e', essaye: '2026-10-11', lu: '2026-10-11' },
			semaine: { empreinte: 'e', essaye: '2026-10-05', lu: '2026-10-05' },
			vieille: { empreinte: 'e', essaye: '2026-09-01', lu: '2026-09-01' },
			essayee: { empreinte: 'x', essaye: jour, lu: '2026-10-01' },
			echec: { empreinte: null, essaye: '2026-10-11', lu: null }
		}
	});
	assert.deepEqual(
		plan.map((p) => `${p.id}:${p.motif}`),
		['neuve:nouvelle', 'modifiee:modifiee', 'echec:nouvelle', 'vieille:relecture', 'semaine:relecture']
	);
	assert.equal(plan[0].lien, 'https://x.fr/neuve');
	const beaucoup = Array.from({ length: 150 }, (_, i) => e(`n${i}`));
	assert.equal(planDuJour({ jour, entrees: beaucoup }).length, LECTURES_PAR_JOUR);
	assert.equal(planDuJour({ jour, entrees: beaucoup, plafond: 3 }).length, 3);
	assert.deepEqual(planDuJour({ jour, entrees: beaucoup, repriseLe: '2026-10-13' }), []);
	assert.equal(planDuJour({ jour: '2026-10-13', entrees: beaucoup, repriseLe: '2026-10-13' }).length, LECTURES_PAR_JOUR);
});

test('un flux qui rend 403 ou 429 attend le lendemain ; une autre erreur, non', () => {
	assert.equal(repriseApres(403, '2026-10-12'), '2026-10-13');
	assert.equal(repriseApres(429, '2026-12-31'), '2027-01-01');
	for (const s of [200, 404, 500]) assert.equal(repriseApres(s, '2026-10-12'), null);
});
