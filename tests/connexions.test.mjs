import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { CLE_REPARTITEUR, renouvelerLesConnexions } from '../src/connexions.mjs';

test('sans repartiteur encore cree, rien ne change', () => {
	const porteur = {};
	assert.equal(renouvelerLesConnexions(porteur), false);
	assert.equal(porteur[CLE_REPARTITEUR], undefined);
});

test('le repartiteur est remplace par un neuf du meme type, l ancien est ferme, meme s il refuse de fermer', async () => {
	const fermes = [];
	class Faux {
		close() {
			fermes.push(this);
			return fermes.length > 1 ? Promise.reject(new Error('deja ferme')) : Promise.resolve();
		}
	}
	const ancien = new Faux();
	const porteur = { [CLE_REPARTITEUR]: ancien };
	assert.equal(renouvelerLesConnexions(porteur), true);
	assert.ok(porteur[CLE_REPARTITEUR] instanceof Faux);
	assert.notEqual(porteur[CLE_REPARTITEUR], ancien);
	assert.equal(renouvelerLesConnexions(porteur), true);
	assert.equal(fermes.length, 2);
	await new Promise((r) => setImmediate(r));
});

test('fetch lit encore apres le renouvellement du vrai repartiteur de Node', async () => {
	const serveur = http.createServer((req, res) => res.end('ok')).listen(0);
	await new Promise((r) => serveur.once('listening', r));
	const url = `http://127.0.0.1:${serveur.address().port}/`;
	try {
		assert.equal(await (await fetch(url)).text(), 'ok');
		const ancien = globalThis[CLE_REPARTITEUR];
		assert.equal(renouvelerLesConnexions(), true);
		assert.notEqual(globalThis[CLE_REPARTITEUR], ancien);
		assert.equal(await (await fetch(url)).text(), 'ok');
	} finally {
		serveur.closeAllConnections();
		serveur.close();
	}
});
