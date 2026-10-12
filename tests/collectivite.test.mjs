import test from 'node:test';
import assert from 'node:assert/strict';
import { baseDeTest } from './d1.mjs';
import { communeDe, communeDesActifs, fragments, nomsDesCommunes } from '../src/annuaire.mjs';
import { reponseCollectivite } from '../src/collectivite.mjs';
import { pageCollectivite } from '../src/pages.mjs';
import { acteDuRecu, adressePublique, deposer, ligneDuRecu, serieDeLaCollectivite } from '../src/service.mjs';
import { pageRecu } from '../src/pages.mjs';
import { onRequestGet } from '../functions/collectivite/[code].js';

const fiche = (nom, insee, siren = null, type = 'mairie') => ({ nom, code_insee_commune: insee, siren, pivot: JSON.stringify([{ type_service_local: type, code_insee_commune: [insee] }]) });
const CRAVANS = { nom: 'Cravans', insee: '17133', siren: '211701339' };
const commune = async (code) => (['17133', '211701339'].includes(code) ? CRAVANS : null);

test("le nom d'une commune vient de sa fiche mairie, sous son code INSEE et son SIREN", () => {
	const noms = nomsDesCommunes([
		fiche('Mairie déléguée - Acqueville', '50001', '200067205'),
		fiche('Mairie - Cravans', '17133', '211701339'),
		fiche('Mairie déléguée - Ancienne', '17133', '200000172'),
		fiche('Mairie - La Hague', '50041', '200067205'),
		fiche('Mairie - Ailleurs', '17134', null, 'cpam'),
		fiche('Accueil - X', '17135'),
		{ nom: 'Mairie - Sans code', pivot: '[]' },
		fiche('Mairie - Marseille - 1er et 7e arrondissements', '13201', '211300553'),
		fiche('Mairie - Marseille - 2e et 3e arrondissements', '13202', '211300553')
	]);
	assert.equal(noms['211300553'], undefined, 'un SIREN partage ne designe aucune page');
	assert.deepEqual(noms['13202'], ['Marseille - 2e et 3e arrondissements', '13202', null]);
	assert.deepEqual(noms['17133'], ['Cravans', '17133', '211701339']);
	assert.deepEqual(noms['211701339'], noms['17133']);
	assert.deepEqual(noms['50001'], ['Acqueville', '50001', null], 'une mairie deleguee ne prend pas le SIREN de la commune nouvelle');
	assert.deepEqual(noms['200067205'], ['La Hague', '50041', '200067205']);
	assert.equal(noms['200000172'], undefined);
	for (const code of ['17134', '17135']) assert.equal(noms[code], undefined, code);
});

test('le nom se relit dans son fragment ; absent ou illisible, il manque sans faire tomber la page', async () => {
	const parts = fragments({ 17133: ['Cravans', '17133', '211701339'] });
	const env = { ASSETS: { fetch: async (url) => (url.pathname === '/annuaire/communes/insee-17.json' ? new Response(JSON.stringify(parts['insee-17'])) : new Response('', { status: 404 })) } };
	const lire = communeDesActifs(env, 'https://empreintes.florianmousseau.com/collectivite/17133');
	assert.deepEqual(await lire('17133'), CRAVANS);
	assert.equal(await lire('17134'), null);
	assert.equal(await lire('2A004'), null);
	assert.equal(await communeDe('17133', async () => new Response('pas du json')), null);
});

async function baseAvecActes() {
	const db = baseDeTest();
	const annuaire = async (code) => (['17133', '211701339'].includes(code) ? [['cravans.fr', '']] : null);
	const deposerActe = (n, url, collectivite, nature, jour, libelle = 'Budget primitif') => {
		const maintenant = new Date(`${jour}T12:00:00Z`);
		return deposer({
			db,
			corps: { type: 'acte', url, collectivite, nature, ...(libelle ? { libelle } : {}) },
			adresse: `a${n}`,
			maintenant,
			annuaire,
			temoin: async () => ({ url, taille: 1, type: 'application/pdf', lu: maintenant.toISOString(), sha256: String(n).repeat(64) })
		});
	};
	await deposerActe(1, 'https://www.cravans.fr/pv-1.pdf', '17133', 'deliberation', '2026-10-11');
	await deposerActe(2, 'https://www.cravans.fr/arrete-2.pdf', '211701339', 'arrete', '2026-10-12', 'Voirie');
	// Un acte d'avant l'objet obligatoire.
	db.sqlite.prepare("UPDATE acte SET objet = NULL WHERE nature = 'arrete'").run();
	await deposerActe(3, 'https://ailleurs.fr/pv-3.pdf', '17133', 'decision', '2026-10-12');
	return db;
}

test("la page d'une commune liste ses actes rattaches, sous ses deux codes, du plus recent au plus ancien, chacun avec son objet, son lien et son recu", async () => {
	const db = await baseAvecActes();
	const r = await reponseCollectivite({ db, code: '17133', commune });
	assert.equal(r.statut, 200);
	assert.equal(r.entetes['cache-control'], 'public, max-age=60');
	assert.match(r.corps, /<h1>Cravans<\/h1>/);
	assert.match(r.corps, /Code INSEE 17133, SIREN 211701339/);
	assert.match(r.corps, /<h2>2 actes datés<\/h2>/);
	assert.match(r.corps, /<th>En ligne le<\/th><th>Nature<\/th><th>Objet<\/th><th>Preuve<\/th>/);
	assert.ok(r.corps.indexOf('12/10/2026') < r.corps.indexOf('11/10/2026'));
	assert.match(r.corps, /<td>Arrêté<\/td><td><a href="https:\/\/www.cravans.fr\/arrete-2.pdf">Sans objet<\/a><\/td>/);
	assert.match(r.corps, /<td>Délibération<\/td><td><a href="https:\/\/www.cravans.fr\/pv-1.pdf">Budget primitif<\/a><\/td>/);
	assert.ok(!r.corps.includes('Décision'), 'un acte declare reste hors de la serie');
	assert.match(r.corps, /<a href="\/recu\/[0-9a-f]{64}">Reçu<\/a>/);
	for (const absent of ['Service-Public', 'noindex', '1111111111111111']) assert.ok(!r.corps.includes(absent), absent);
	assert.match(r.corps, /<p class="compte">Actes suivis depuis le 11\/10\/2026, lus sur le site officiel de la commune.<\/p>/);
	assert.match(r.corps, /<a class="bouton principal" href="\/acte">Dater la mise en ligne d’un acte<\/a>/);
});

test("le recu d'un acte rattache dit l'acte, sa commune et son jour en ligne ; un acte d'avant l'objet reste sans objet ni lien", async () => {
	const db = await baseAvecActes();
	const { recu } = db.sqlite.prepare("SELECT recu FROM acte WHERE nature = 'deliberation'").get();
	const acte = await acteDuRecu({ db, id: recu });
	const html = pageRecu(await ligneDuRecu({ db, id: recu }), acte);
	assert.match(html, /<h2>En ligne le 11\/10\/2026<\/h2>/);
	assert.match(html, /<dd>Délibération, <a href="https:\/\/www.cravans.fr\/pv-1.pdf">Budget primitif<\/a><\/dd>/);
	assert.match(html, /<a href="\/collectivite\/17133">17133<\/a>/);
	assert.match(html, /<button type="button" id="imprimer" class="principal">Imprimer le reçu<\/button>/);
	assert.equal(await acteDuRecu({ db, id: 'x' }), null);
	assert.match(pageRecu({ sha256: 'a'.repeat(64), jour: '2026-10-12', place: 1, recu: 'b'.repeat(64) }), /<h2>Document daté du 12\/10\/2026<\/h2>/);
	assert.match(pageRecu({ sha256: 'a'.repeat(64), jour: '2026-10-12', place: 1, recu: 'b'.repeat(64) }, { collectivite: '17133', nature: 'arrete', objet: null, url: null }), /<dd>Arrêté, Sans objet<\/dd>/);
});

test("l'adresse d'un acte ne se montre pas quand son chemin nomme une personne", () => {
	assert.equal(adressePublique('https://www.cravans.fr/wp-content/uploads/2026/10/PV-03.09.2026.pdf'), 'https://www.cravans.fr/wp-content/uploads/2026/10/PV-03.09.2026.pdf');
	assert.equal(adressePublique('https://www.cravans.fr/arretes/arrete-de-M.-Jean-Dupont.pdf'), null);
	assert.equal(adressePublique('pas une adresse'), null);
});

test('une page par commune : le SIREN et les minuscules renvoient au code INSEE, un code illisible est introuvable', async () => {
	const db = baseDeTest();
	assert.deepEqual((await reponseCollectivite({ db, code: '211701339', commune })).entetes.location, '/collectivite/17133');
	const corse = await reponseCollectivite({ db, code: '2a004', commune: async () => null });
	assert.equal(corse.statut, 301);
	assert.equal(corse.entetes.location, '/collectivite/2A004');
	for (const code of ['1713', '211701338', 'abc', undefined]) assert.equal((await reponseCollectivite({ db, code, commune })).statut, 404, String(code));
	const inconnue = await reponseCollectivite({ db, code: '17999', commune: async () => null });
	assert.equal(inconnue.statut, 200);
	assert.match(inconnue.corps, /<h1>Collectivité 17999<\/h1>/);
	assert.match(inconnue.corps, /Aucun acte daté/);
	assert.match(inconnue.corps, /<p class="compte">Actes lus sur le site officiel de la commune.<\/p>/);
	assert.match(inconnue.corps, /<meta name="robots" content="noindex">/);
});

test('une serie plus longue que la page dit combien elle en montre', async () => {
	const db = await baseAvecActes();
	const serie = await serieDeLaCollectivite({ db, codes: ['17133', '211701339'], limite: 1 });
	assert.equal(serie.total, 2);
	assert.equal(serie.actes.length, 1);
	assert.match(pageCollectivite({ code: '17133', commune: CRAVANS, serie }), /Les 1 plus récents sur 2\./);
	assert.match(pageCollectivite({ code: '17133', commune: { nom: 'A & B', insee: '17133', siren: null }, serie }), /<h1>A &amp; B<\/h1>\n<p class="sous-titre">Code 17133<\/p>/);
});

test('la Function sert la page et la redirection', async () => {
	const db = await baseAvecActes();
	const parts = fragments({ 17133: ['Cravans', '17133', '211701339'], 211701339: ['Cravans', '17133', '211701339'] });
	const env = { DEPOTS: db, ASSETS: { fetch: async (url) => new Response(JSON.stringify(parts[url.pathname.split('/').at(-1).slice(0, -5)] ?? {})) } };
	const page = await onRequestGet({ params: { code: '17133' }, env, request: new Request('https://empreintes.florianmousseau.com/collectivite/17133') });
	assert.equal(page.status, 200);
	assert.match(await page.text(), /<h1>Cravans<\/h1>/);
	const renvoi = await onRequestGet({ params: { code: '211701339' }, env, request: new Request('https://empreintes.florianmousseau.com/collectivite/211701339') });
	assert.equal(renvoi.status, 301);
	assert.equal(renvoi.headers.get('location'), '/collectivite/17133');
});
