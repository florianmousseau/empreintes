import test from 'node:test';
import assert from 'node:assert/strict';
import { BESOINS } from '../src/besoins.mjs';
import { PLAN, pageAccueil, pageBesoin } from '../src/pages.mjs';
import { decider } from '../src/hote.mjs';
import { planDe } from '../src/edition.mjs';

const texteDe = (html) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, '');

test('chaque besoin a sa page : son titre en h1, sa phrase, le geste de dater sur la page, sans signe double detache', () => {
	for (const b of BESOINS) {
		const html = pageBesoin(b);
		assert.match(html, new RegExp(`<h1>${b.titre}</h1>\\n<p class="chapeau">${b.chapeau}</p>`));
		assert.match(html, /<form id="formulaire" class="carte">/);
		if (b.geste === 'lien') {
			assert.match(html, /<label for="url">Adresse de la page<\/label>\n<input type="text" id="url"[^>]*required>/);
			assert.doesNotMatch(html, /id="fichier"/);
		} else assert.match(html, /id="fichier"/);
		assert.match(html, /<script type="module" src="\/deposer.js"><\/script>/);
		assert.match(html, new RegExp(`<link rel="canonical" href="https://temoinpublic.fr${b.chemin}">`));
		assert.doesNotMatch(html, /noindex|qualifi|certifi/i);
		assert.equal(texteDe(html).match(/[^\S ][:;?!»]/g), null);
		assert.ok(b.chemin.startsWith('/besoin/'));
		assert.ok(b.description.length <= 170, b.chemin);
	}
});

test('les besoins sont au plan francais, lies de l accueil, et absents de l edition allemande', () => {
	for (const b of BESOINS) {
		assert.ok(PLAN.includes(b.chemin));
		assert.ok(!planDe('de').includes(b.chemin));
		assert.ok(pageAccueil([]).includes(`<a href="${b.chemin}">${b.nom}</a>`));
		assert.ok(!pageAccueil([], 'de').includes(b.chemin));
		assert.deepEqual(decider(`https://datumszeuge.de${b.chemin}`), { action: 'redirection', vers: `https://temoinpublic.fr${b.chemin}` });
	}
});
