import test from 'node:test';
import assert from 'node:assert/strict';
import { baseDeTest } from './d1.mjs';
import { OUTILS, VERSIONS_MCP, traiterMessage } from '../src/mcp.mjs';
import { onRequestDelete, onRequestGet, onRequestOptions, onRequestPost } from '../functions/mcp.js';

const H = 'a'.repeat(64);
const appel = (method, params, id = 1) => ({ jsonrpc: '2.0', id, method, params });
const outil = (name, args) => appel('tools/call', { name, arguments: args });

const post = (corps) => new Request('https://temoinpublic.fr/mcp', { method: 'POST', body: corps, headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.9' } });
const mcp = async (env, message) => {
	const r = await onRequestPost({ request: post(JSON.stringify(message)), env });
	return { statut: r.status, corps: r.status === 200 ? await r.json() : null };
};

test("l'initialisation rend la version demandee si elle est connue, la plus recente sinon", async () => {
	const ancienne = await traiterMessage(appel('initialize', { protocolVersion: '2024-11-05' }), {});
	assert.equal(ancienne.result.protocolVersion, '2024-11-05');
	assert.deepEqual(ancienne.result.capabilities, { tools: {} });
	assert.equal(ancienne.result.serverInfo.name, 'temoinpublic');
	assert.match(ancienne.result.instructions, /dater_url/);
	assert.equal((await traiterMessage(appel('initialize', { protocolVersion: '1999-01-01' }), {})).result.protocolVersion, VERSIONS_MCP[0]);
	assert.deepEqual((await traiterMessage(appel('ping'), {})).result, {});
});

test('quatre outils, chacun avec son schema ; les lectures se declarent sans effet', async () => {
	const { tools } = (await traiterMessage(appel('tools/list'), {})).result;
	assert.deepEqual(
		tools.map((o) => o.name),
		['dater_url', 'dater_empreinte', 'chercher_empreinte', 'lire_recu']
	);
	for (const o of OUTILS) assert.equal(o.inputSchema.type, 'object', o.name);
	assert.deepEqual(
		tools.filter((o) => o.annotations?.readOnlyHint).map((o) => o.name),
		['chercher_empreinte', 'lire_recu']
	);
});

test('une notification ne rend rien ; une requete mal formee ou inconnue rend son erreur JSON-RPC', async () => {
	assert.equal(await traiterMessage({ jsonrpc: '2.0', method: 'notifications/initialized' }, {}), null);
	assert.equal((await traiterMessage([appel('ping')], {})).error.code, -32600);
	assert.equal((await traiterMessage(null, {})).error.code, -32600);
	assert.equal((await traiterMessage({ jsonrpc: '1.0', id: 3, method: 'ping' }, {})).error.code, -32600);
	assert.equal((await traiterMessage(appel('resources/list'), {})).error.code, -32601);
	assert.equal((await traiterMessage(outil('effacer', {}), {})).error.code, -32602);
});

test("dater une empreinte rend le recu et son adresse ; la chercher et lire le recu le retrouvent", async () => {
	const env = { DEPOTS: baseDeTest() };
	const date = await mcp(env, outil('dater_empreinte', { sha256: H, libelle: 'Contrat' }));
	assert.equal(date.statut, 200);
	const r = date.corps.result;
	assert.equal(r.isError, false);
	assert.equal(r.structuredContent.ligne, 1);
	assert.equal(r.structuredContent.recu.libelle, 'Contrat');
	assert.equal(r.structuredContent.adresse, `https://temoinpublic.fr/recu/${r.structuredContent.id}`);
	assert.deepEqual(JSON.parse(r.content[0].text), r.structuredContent);

	const trouve = (await mcp(env, outil('chercher_empreinte', { sha256: H.toUpperCase() }))).corps.result.structuredContent;
	assert.deepEqual(trouve.depots, [{ jour: r.structuredContent.jour, ligne: 1, adresse: r.structuredContent.adresse }]);
	const lu = (await mcp(env, outil('lire_recu', { id: r.structuredContent.id }))).corps.result.structuredContent;
	assert.equal(lu.sha256, H);
});

test('un refus du service, une empreinte illisible ou un recu inconnu sont des erreurs d’outil, pas de protocole', async () => {
	const env = { DEPOTS: baseDeTest() };
	const refus = (await mcp(env, outil('dater_empreinte', { sha256: 'court' }))).corps.result;
	assert.equal(refus.isError, true);
	assert.equal(refus.structuredContent.statut, 400);
	const url = (await mcp(env, outil('dater_url', { url: 'http://169.254.169.254/' }))).corps.result;
	assert.equal(url.isError, true);
	assert.equal((await mcp(env, outil('chercher_empreinte', {}))).corps.result.isError, true);
	assert.equal((await mcp(env, outil('lire_recu', { id: H }))).corps.result.isError, true);
	assert.equal((await mcp(env, appel('tools/call', { name: 'lire_recu' }))).corps.result.isError, true);
});

test('la Function : 202 sur une notification, 400 sur du JSON illisible, 405 hors POST, preflight ouvert', async () => {
	const env = { DEPOTS: baseDeTest() };
	assert.equal((await mcp(env, { jsonrpc: '2.0', method: 'notifications/initialized' })).statut, 202);
	const illisible = await onRequestPost({ request: post('{'), env });
	assert.equal(illisible.status, 400);
	assert.equal((await illisible.json()).error.code, -32700);
	assert.equal(onRequestGet().status, 405);
	assert.equal(onRequestDelete().headers.get('allow'), 'POST');
	const options = onRequestOptions();
	assert.equal(options.status, 204);
	assert.match(options.headers.get('access-control-allow-headers'), /mcp-protocol-version/);
});
