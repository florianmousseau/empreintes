import test from 'node:test';
import assert from 'node:assert/strict';
import { baseDeTest } from './d1.mjs';
import { OFFRES, PLAFOND_DU_JOUR, PROFILS, comptesDAttente, inscrire, lireInscription } from '../src/attente.mjs';
import { CHEMIN_OFFRE_MARCHES, COUVERTURE, ECHANTILLON, lienDeLAvis } from '../src/offre.mjs';
import { ISSUES_DE_L_ATTENTE, pageAttente, pageOffreMarches } from '../src/pages.mjs';
import { decider } from '../src/hote.mjs';
import { onRequestPost } from '../functions/api/attente.js';
import { onRequestGet as sonde } from '../functions/health.js';

const texteDe = (html) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, '');
const envoyer = (env, champs) => onRequestPost({ request: new Request('https://temoinpublic.fr/api/attente', { method: 'POST', body: new URLSearchParams(champs) }), env });
const lignes = (db) => db.sqlite.prepare('SELECT offre, adresse, profil, jour FROM attente ORDER BY adresse').all();

test("une inscription garde l'adresse en minuscules, l'offre et le profil, rien d'autre", () => {
	assert.deepEqual(lireInscription({ offre: 'marches-publics', adresse: '  Achats@Ville-Exemple.FR ', profil: 'acheteur' }), { offre: 'marches-publics', adresse: 'achats@ville-exemple.fr', profil: 'acheteur' });
	assert.equal(lireInscription({ offre: 'marches-publics', adresse: 'a@b.fr', profil: 'inconnu' }).profil, 'autre');
	assert.equal(lireInscription({ offre: 'marches-publics', adresse: 'a@b.fr' }).profil, 'autre');
	assert.deepEqual(Object.keys(PROFILS), ['entreprise', 'acheteur', 'autre']);
	assert.deepEqual(OFFRES, ['marches-publics']);
});

test("une adresse illisible, une offre inconnue ou un champ cache rempli ne s'inscrivent pas", () => {
	for (const adresse of ['', 'sans-arobase.fr', 'a@b', 'a b@c.fr', '<a@b.fr>', `${'a'.repeat(250)}@b.fr`, undefined]) assert.deepEqual(lireInscription({ offre: 'marches-publics', adresse }), { refus: 'adresse' }, String(adresse));
	assert.deepEqual(lireInscription({ offre: 'autre-chose', adresse: 'a@b.fr' }), { refus: 'offre' });
	assert.deepEqual(lireInscription({ offre: 'marches-publics', adresse: 'a@b.fr', site: 'https://spam' }), { robot: true });
});

test('une adresse deja inscrite ne fait pas de seconde ligne, et la reponse est la meme', async () => {
	const db = baseDeTest();
	const ins = { offre: 'marches-publics', adresse: 'a@b.fr', profil: 'entreprise' };
	assert.equal(await inscrire(db, ins, '2026-10-16'), 'inscrit');
	assert.equal(await inscrire(db, { ...ins, profil: 'autre' }, '2026-10-17'), 'inscrit');
	assert.deepEqual(
		lignes(db).map((l) => ({ ...l })),
		[{ offre: 'marches-publics', adresse: 'a@b.fr', profil: 'entreprise', jour: '2026-10-16' }]
	);
	assert.deepEqual(await comptesDAttente(db), { 'marches-publics': 1 });
	assert.deepEqual(await comptesDAttente(baseDeTest()), { 'marches-publics': 0 });
});

test('au plafond du jour, une offre refuse les inscriptions jusqu’au lendemain', async () => {
	const db = baseDeTest();
	for (let i = 0; i < PLAFOND_DU_JOUR; i++) await inscrire(db, { offre: 'marches-publics', adresse: `a${i}@b.fr`, profil: 'autre' }, '2026-10-16');
	assert.equal(await inscrire(db, { offre: 'marches-publics', adresse: 'z@b.fr', profil: 'autre' }, '2026-10-16'), 'plafond');
	assert.equal(await inscrire(db, { offre: 'marches-publics', adresse: 'z@b.fr', profil: 'autre' }, '2026-10-17'), 'inscrit');
});

test('le formulaire envoye rend une page, sans script, et un robot recoit celle d’une personne', async () => {
	const db = baseDeTest();
	const ok = await envoyer({ DEPOTS: db }, { offre: 'marches-publics', adresse: 'a@b.fr', profil: 'entreprise' });
	assert.equal(ok.status, 200);
	assert.match(ok.headers.get('content-type'), /text\/html/);
	assert.equal(ok.headers.get('cache-control'), 'no-store');
	assert.match(await ok.text(), /<h1>Votre adresse est notée<\/h1>/);
	const mauvaise = await envoyer({ DEPOTS: db }, { offre: 'marches-publics', adresse: 'pas une adresse' });
	assert.equal(mauvaise.status, 400);
	assert.match(await mauvaise.text(), /Cette adresse ne se lit pas/);
	const robot = await envoyer({ DEPOTS: db }, { offre: 'marches-publics', adresse: 'robot@b.fr', site: 'x' });
	assert.equal(robot.status, 200);
	assert.equal(lignes(db).length, 1);
	const json = new Request('https://temoinpublic.fr/api/attente', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } });
	assert.equal((await onRequestPost({ request: json, env: { DEPOTS: db } })).status, 400);
	for (let i = 1; i < PLAFOND_DU_JOUR; i++) await envoyer({ DEPOTS: db }, { offre: 'marches-publics', adresse: `a${i}@b.fr` });
	assert.equal((await envoyer({ DEPOTS: db }, { offre: 'marches-publics', adresse: 'z@b.fr' })).status, 429);
});

test("chaque page de reponse dit l'issue et ne s'indexe pas", () => {
	for (const [issue, [titre]] of Object.entries(ISSUES_DE_L_ATTENTE)) {
		const html = pageAttente(issue);
		assert.match(html, /<meta name="robots" content="noindex">/);
		assert.ok(html.includes(`<h1>${titre}</h1>`), issue);
		assert.match(html, /href="\/marches-publics"/);
	}
});

test("la page de l'offre ne dit aucun prix, montre l'echantillon et porte le formulaire", () => {
	const html = pageOffreMarches();
	const texte = texteDe(html);
	for (const interdit of [/€/, /\beuros?\b/i, /tarif/i, /abonnement/i, /gratuit/i, /payant/i, /\bHT\b/]) assert.doesNotMatch(texte, interdit);
	assert.deepEqual(texte.match(/[^\S ][:;?!»%]/g), null, 'deux-points et pour cent soudes');
	assert.match(html, /<link rel="canonical" href="https:\/\/temoinpublic.fr\/marches-publics">/);
	assert.match(html, /<form method="post" action="\/api\/attente" class="carte">/);
	assert.match(html, /<input type="hidden" name="offre" value="marches-publics">/);
	assert.match(html, /<div hidden><label for="site">/);
	assert.doesNotMatch(html, /<script/);
	for (const c of ECHANTILLON) {
		assert.ok(html.includes(`<a href="${lienDeLAvis(c.boamp)}">BOAMP ${c.boamp}</a>`), c.boamp);
		assert.match(c.reglement, /^[0-9a-f]{64}$/);
		assert.match(c.criteres, /\.$/, 'une phrase');
	}
	assert.match(texte, /6 consultations prises au vol entre le 13\/10\/2026 et le 15\/10\/2026/);
	assert.ok(texte.includes(`il suit ${COUVERTURE.consultations} consultations`));
	assert.equal(CHEMIN_OFFRE_MARCHES, '/marches-publics');
	assert.equal(lienDeLAvis('26-98309'), 'https://www.boamp.fr/pages/avis/?q=idweb:26-98309');
});

test("l'offre n'existe qu'en francais : l'edition allemande y renvoie", () => {
	assert.deepEqual(decider('https://datumszeuge.de/marches-publics'), { action: 'redirection', vers: 'https://temoinpublic.fr/marches-publics' });
});

test('la sonde compte les adresses en attente, et reste a 200 sans base ou quand elle se tait', async () => {
	const assets = { fetch: async () => new Response('', { status: 404 }) };
	const lire = async (env) => (await sonde({ request: new Request('https://temoinpublic.fr/health'), env })).json();
	assert.equal((await lire({ ASSETS: assets })).attente, null);
	const db = baseDeTest();
	await inscrire(db, { offre: 'marches-publics', adresse: 'a@b.fr', profil: 'autre' }, '2026-10-16');
	assert.deepEqual((await lire({ ASSETS: assets, DEPOTS: db })).attente, { 'marches-publics': 1 });
	const lie = {
		bind: () => lie,
		all: async () => {
			throw new Error('D1');
		}
	};
	assert.equal((await lire({ ASSETS: assets, DEPOTS: { prepare: () => lie } })).attente, null);
});
