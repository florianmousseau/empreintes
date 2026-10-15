import test from 'node:test';
import assert from 'node:assert/strict';
import { baseDeTest } from './d1.mjs';
import { cheminDeLActe, lireAdresse, resoudre } from '../src/adresse.mjs';
import { reponseAdresse } from '../src/collectivite.mjs';
import { decider } from '../src/hote.mjs';
import { traiterMessage } from '../src/mcp.mjs';
import { pageAdresse, pageAdresses } from '../src/pages.mjs';
import { deposer, ligneEtAdresseDuRecu, versionsDeLaSource } from '../src/service.mjs';
import { onRequestGet as pageDeLAdresse } from '../functions/actes/[[chemin]].js';
import { onRequestGet as apiRecu } from '../functions/api/recus/[id].js';

const CRAVANS = { nom: 'Cravans', insee: '17133', siren: '211701339' };
const commune = async (code) => (['17133', '211701339'].includes(code) ? CRAVANS : null);
const annuaire = async (code) => (['17133', '211701339'].includes(code) ? [['cravans.fr', '']] : null);

const A = `abcdef0123${'4'.repeat(54)}`;
const B = `abcdef01ff${'5'.repeat(54)}`;
const C = `abcdef0123${'6'.repeat(54)}`;

async function dater(db, { n, url, sha256, jour, nature = 'deliberation', libelle = 'Budget primitif', collectivite = '17133' }) {
	const maintenant = new Date(`${jour}T12:00:00Z`);
	const r = await deposer({
		db,
		corps: { type: 'acte', url, collectivite, nature, libelle },
		adresse: `a${n}`,
		maintenant,
		annuaire,
		temoin: async () => ({ url, taille: 1, type: 'application/pdf', lu: maintenant.toISOString(), sha256 })
	});
	assert.equal(r.statut, 201, r.corps);
	return JSON.parse(r.corps).id;
}

async function base() {
	const db = baseDeTest();
	const ids = {
		a: await dater(db, { n: 1, url: 'https://www.cravans.fr/pv-1.pdf', sha256: A, jour: '2026-10-11' }),
		b: await dater(db, { n: 2, url: 'https://www.cravans.fr/pv-2.pdf', sha256: B, jour: '2026-10-11', nature: 'arrete', libelle: 'Voirie' }),
		c: await dater(db, { n: 3, url: 'https://www.cravans.fr/pv-1.pdf', sha256: C, jour: '2026-10-12' })
	};
	return { db, ids };
}

const repondre = (db, chemin) => reponseAdresse({ db, segments: chemin.split('/').slice(2), commune });

test("l'adresse d'un acte se compose et se lit : code en capitales, jour, nature connue, au moins 8 hex", () => {
	assert.equal(cheminDeLActe({ collectivite: '17133', jour: '2026-10-11', nature: 'deliberation', sha256: A }), '/actes/17133/2026-10-11/deliberation-abcdef012344');
	assert.deepEqual(lireAdresse(['2a004', '2026-10-11', 'Deliberation-ABCDEF01']), { code: '2A004', jour: '2026-10-11', prefixe: 'abcdef01' });
	assert.deepEqual(lireAdresse(['211701339', '2026-10-11', 'abcdef01']), { code: '211701339', jour: '2026-10-11', prefixe: 'abcdef01' });
	for (const segments of [
		['17133', '2026-10-11', 'deliberation-abcdef0'],
		['17133', '2026-10-11', 'avis-abcdef01'],
		['17133', '2026-13-45', 'abcdef01'],
		['17133', '11-10-2026', 'abcdef01'],
		['1713', '2026-10-11', 'abcdef01'],
		['211701338', '2026-10-11', 'abcdef01'],
		['17133', '2026-10-11'],
		null
	])
		assert.equal(lireAdresse(segments), null, String(segments));
	assert.deepEqual(resoudre('/x', []), { statut: 404 });
});

test('la forme canonique sert la preuve, la source et les versions vues a la meme source', async () => {
	const { db, ids } = await base();
	const r = await repondre(db, '/actes/17133/2026-10-11/deliberation-abcdef012344');
	assert.equal(r.statut, 200);
	assert.equal(r.entetes['cache-control'], 'public, max-age=300');
	assert.match(r.corps, /<h1>Délibération, Cravans<\/h1>\n<p class="sous-titre">Budget primitif<\/p>/);
	assert.match(r.corps, new RegExp(`<code class="racine">${A}</code>`));
	assert.match(r.corps, new RegExp(`<a href="/recu/${ids.a}">${ids.a.slice(0, 12)}</a>`));
	assert.match(r.corps, /<a href="\/depots\/2026-10-11.jsonl">n° 1 du 11\/10\/2026<\/a>/);
	assert.match(r.corps, /<dt>Source<\/dt><dd><a href="https:\/\/www.cravans.fr\/pv-1.pdf">/);
	assert.match(r.corps, /<a href="\/collectivite\/17133">Cravans<\/a>/);
	assert.match(r.corps, /<link rel="canonical" href="https:\/\/temoinpublic.fr\/actes\/17133\/2026-10-11\/deliberation-abcdef012344">/);
	assert.match(r.corps, /"@type":"Legislation","legislationIdentifier":"https:\/\/temoinpublic.fr\/actes\/17133\/2026-10-11\/deliberation-abcdef012344"/);
	assert.match(r.corps, /<h2>2 versions à cette source<\/h2>/);
	assert.match(r.corps, /<td>Cette page<\/td>/);
	assert.match(r.corps, /<a href="\/actes\/17133\/2026-10-12\/deliberation-abcdef012366">/);
	assert.doesNotMatch(r.corps, /noindex/);
	const autre = await repondre(db, '/actes/17133/2026-10-11/arrete-abcdef01ff55');
	assert.equal(autre.statut, 200);
	assert.match(autre.corps, /<h2>1 version à cette source<\/h2>/);
	assert.deepEqual(await versionsDeLaSource({ db, collectivite: '17133', url: null }), []);
});

test('un prefixe court ou une ecriture voisine renvoie en 301 a la forme canonique', async () => {
	const { db } = await base();
	for (const chemin of ['/actes/17133/2026-10-11/abcdef0123', '/actes/17133/2026-10-11/arrete-abcdef0123', `/actes/17133/2026-10-11/deliberation-${A}`, '/actes/17133/2026-10-11/DELIBERATION-ABCDEF012344']) {
		const r = await repondre(db, chemin);
		assert.equal(r.statut, 301, chemin);
		assert.equal(r.entetes.location, '/actes/17133/2026-10-11/deliberation-abcdef012344', chemin);
	}
	assert.equal((await repondre(db, '/actes/17133/2026-10-11/abcdef01ff')).entetes.location, '/actes/17133/2026-10-11/arrete-abcdef01ff55');
});

test("un prefixe ambigu rend la liste des adresses, l'inconnu rend 404", async () => {
	const { db } = await base();
	const r = await repondre(db, '/actes/17133/2026-10-11/abcdef01');
	assert.equal(r.statut, 300);
	assert.match(r.corps, /<h1>2 actes à cette adresse<\/h1>/);
	assert.match(r.corps, /<li><a href="\/actes\/17133\/2026-10-11\/deliberation-abcdef012344">/);
	assert.match(r.corps, /<li><a href="\/actes\/17133\/2026-10-11\/arrete-abcdef01ff55">/);
	assert.match(r.corps, /noindex/);
	for (const chemin of ['/actes/17133/2026-10-11/abcdef0', '/actes/17133/2026-10-11/deadbeef00', '/actes/17133/2026-10-13/abcdef0123', '/actes/17134/2026-10-11/abcdef0123', '/actes/17133/2026-10-11/avis-abcdef0123', '/actes/17133'])
		assert.equal((await repondre(db, chemin)).statut, 404, chemin);
	assert.match(pageAdresses([]), /<h1>0 actes à cette adresse<\/h1>/);
});

test("la page d'adresse ne montre ni l'objet ni la source qui pourraient nommer une personne", async () => {
	const db = baseDeTest();
	await dater(db, { n: 1, url: 'https://www.cravans.fr/arrete-occupation-domaine-public-SIMON.pdf', sha256: A, jour: '2026-10-11', nature: 'arrete', libelle: 'occupation du domaine public SIMON' });
	const r = await repondre(db, '/actes/17133/2026-10-11/arrete-abcdef012344');
	assert.equal(r.statut, 200);
	assert.doesNotMatch(r.corps, /SIMON/);
	assert.match(r.corps, /<p class="sous-titre">Sans objet<\/p>/);
	assert.doesNotMatch(r.corps, /<dt>Source<\/dt>/);
	const sansNom = pageAdresse({ acte: { collectivite: '17999', jour: '2026-10-11', place: 1, nature: 'decision', sha256: A, recu: 'b'.repeat(64), objet: null, url: null } });
	assert.match(sansNom, /<h1>Décision, Collectivité 17999<\/h1>/);
	assert.doesNotMatch(sansNom, /à cette source/);
});

test("le recu d'un acte porte son adresse dans l'API et le MCP ; un autre depot ne la porte pas", async () => {
	const { db, ids } = await base();
	const env = { DEPOTS: db };
	const lu = await (await apiRecu({ params: { id: ids.a }, env })).json();
	assert.equal(lu.acte, 'https://temoinpublic.fr/actes/17133/2026-10-11/deliberation-abcdef012344');
	assert.equal(lu.sha256, A);
	assert.equal(await ligneEtAdresseDuRecu({ db, id: 'f'.repeat(64) }), null);
	db.sqlite.prepare('INSERT INTO depot (jour, place, sha256, recu) VALUES (?, ?, ?, ?)').run('2026-10-11', 9, 'c'.repeat(64), 'd'.repeat(64));
	assert.equal((await ligneEtAdresseDuRecu({ db, id: 'd'.repeat(64) })).acte, undefined);
	const service = { ligneDuRecu: (id) => ligneEtAdresseDuRecu({ db, id }) };
	const appel = (id) => traiterMessage({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'lire_recu', arguments: { id } } }, service);
	assert.equal((await appel(ids.a)).result.structuredContent.acte, lu.acte);
	assert.equal((await appel('d'.repeat(64))).result.structuredContent.acte, undefined);
});

test("la Function sert l'adresse, et l'edition allemande renvoie au francais", async () => {
	const { db } = await base();
	const env = { DEPOTS: db, ASSETS: { fetch: async () => new Response('', { status: 404 }) } };
	const requete = (chemin) => ({ params: { chemin: chemin.split('/').slice(2) }, env, request: new Request(`https://temoinpublic.fr${chemin}`) });
	const page = await pageDeLAdresse(requete('/actes/17133/2026-10-11/deliberation-abcdef012344'));
	assert.equal(page.status, 200);
	assert.match(await page.text(), /<h1>Délibération, Collectivité 17133<\/h1>/);
	const renvoi = await pageDeLAdresse(requete('/actes/17133/2026-10-11/abcdef01ff'));
	assert.equal(renvoi.status, 301);
	assert.equal((await pageDeLAdresse({ params: {}, env, request: new Request('https://temoinpublic.fr/actes') })).status, 404);
	assert.deepEqual(decider('https://datumszeuge.de/actes/17133/2026-10-11/abcdef01'), { action: 'redirection', vers: 'https://temoinpublic.fr/actes/17133/2026-10-11/abcdef01' });
});
