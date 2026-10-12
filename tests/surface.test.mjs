// La surface construite, servie par un serveur local : le script de verification et la sonde la lisent comme en ligne.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { verifierEmpreinte } from '../scripts/verifier.mjs';
import { onRequestGet } from '../functions/health.js';

const DIST = path.resolve(import.meta.dirname, '..', 'dist');

function servir() {
	const serveur = http.createServer((req, res) => {
		const f = path.join(DIST, decodeURIComponent(new URL(req.url, 'http://x').pathname));
		if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return res.writeHead(404).end();
		res.writeHead(200).end(fs.readFileSync(f));
	});
	return new Promise((ok) => serveur.listen(0, '127.0.0.1', () => ok(serveur)));
}

test('la construction a produit la surface', () => {
	for (const f of ['index.html', 'verifier.html', 'deposer.html', 'deposer.js', 'journal.html', 'fichier.js', '404.html', 'depot.mjs', 'documentation.html', 'tours.json', 'version.json', 'chaine.mjs', 'verifier.js', '_headers']) assert.ok(fs.existsSync(path.join(DIST, f)), f);
});

test('un fichier du journal se dit servi tel quel ; une empreinte inconnue ne trouve rien', async () => {
	const serveur = await servir();
	const site = `http://127.0.0.1:${serveur.address().port}`;
	try {
		const { tours } = JSON.parse(fs.readFileSync(path.join(DIST, 'tours.json'), 'utf8'));
		const releve = JSON.parse(fs.readFileSync(path.join(DIST, 'empreintes', `${tours[0].id}.json`), 'utf8'));
		const feuille = releve.feuilles.find((f) => !f.cle.includes(':'));
		const constats = await verifierEmpreinte(site, feuille.sha256);
		assert.ok(constats.length >= 1);
		assert.ok(constats.every((c) => c.ok));
		assert.equal(constats.find((c) => c.cle === feuille.cle).premier, tours[0].id);
		assert.deepEqual(await verifierEmpreinte(site, 'f'.repeat(63) + '0'), []);
	} finally {
		serveur.close();
	}
});

test('la sonde repond 200 en JSON, sans cache, avec le commit servi', async () => {
	const env = { ASSETS: { fetch: async (url) => new Response(fs.readFileSync(path.join(DIST, new URL(url).pathname))) } };
	const r = await onRequestGet({ request: new Request('https://empreintes.florianmousseau.com/health'), env });
	assert.equal(r.status, 200);
	assert.equal(r.headers.get('cache-control'), 'no-store');
	const corps = await r.json();
	assert.ok(['ok', 'attention', 'rouge'].includes(corps.alerte));
	assert.equal(corps.service, 'empreintes');
	assert.ok(corps.deploye.commit);
	const vide = await onRequestGet({ request: new Request('https://x/health'), env: { ASSETS: { fetch: async () => new Response('', { status: 404 }) } } });
	assert.equal((await vide.json()).alerte, 'rouge');
});
