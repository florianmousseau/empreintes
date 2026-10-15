import test from 'node:test';
import assert from 'node:assert/strict';
import { baseDeTest } from './d1.mjs';
import { ACTES_DE_LA_FLOTTE_PAR_JOUR, CLE_DE_LA_FLOTTE, DEPOTS_PAR_ADRESSE, estLaFlotte, plafond } from '../src/depot.mjs';
import { bilanPublic, deposer, serieDeLaCollectivite } from '../src/service.mjs';

const midi = new Date('2026-10-15T12:00:00Z');
const lendemain = new Date('2026-10-16T12:00:00Z');
const corpsDe = (r) => JSON.parse(r.corps);
const annuaire = async (code) => (code === '17133' ? [['cravans.fr', '']] : null);
const pdf = (n) => `https://www.cravans.fr/actes/deliberation-${n}.pdf`;
const acte = (n, autres = {}) => ({ type: 'acte', url: pdf(n), collectivite: '17133', nature: 'deliberation', libelle: `Deliberation ${n}`, ...autres });
const temoinDe = (empreinte) => async (admise) => ({ url: admise.url, taille: 3, type: 'application/pdf', lu: midi.toISOString(), sha256: empreinte(admise.url) });
const parUrl = temoinDe((url) => url.match(/(\d+)\.pdf$/)[1].padStart(64, '0'));
const glaner = (db, corps, options = {}) => deposer({ db, corps, adresse: '203.0.113.9', maintenant: midi, temoin: parUrl, annuaire, flotte: true, ...options });

test('le jeton de la glane se reconnait dans l en-tete, jamais sans jeton configure', async () => {
	assert.equal(await estLaFlotte('Bearer s3cret', 's3cret'), true);
	assert.equal(await estLaFlotte('Bearer  s3cret ', 's3cret'), true);
	assert.equal(await estLaFlotte('Bearer autre', 's3cret'), false);
	assert.equal(await estLaFlotte('Basic s3cret', 's3cret'), false);
	assert.equal(await estLaFlotte(null, 's3cret'), false);
	assert.equal(await estLaFlotte('Bearer ', ''), false);
	assert.equal(await estLaFlotte('Bearer x', undefined), false);
});

test('la glane a son propre plafond, hors de celui des adresses', () => {
	assert.deepEqual(plafond({ deCetteAdresse: DEPOTS_PAR_ADRESSE + 1, duJour: 1e6, instant: midi.toISOString(), flotte: true }), { ok: true });
	const r = plafond({ deCetteAdresse: ACTES_DE_LA_FLOTTE_PAR_JOUR, duJour: 0, instant: midi.toISOString(), flotte: true });
	assert.equal(r.ok, false);
	assert.match(r.motif, /flotte/);
});

test('la glane depose plus de vingt actes dans la journee et ne compte pas parmi les deposants', async () => {
	const db = baseDeTest();
	for (let n = 1; n <= DEPOTS_PAR_ADRESSE + 5; n++) assert.equal((await glaner(db, acte(n))).statut, 201, `acte ${n}`);
	const serie = await serieDeLaCollectivite({ db, codes: ['17133'] });
	assert.equal(serie.total, DEPOTS_PAR_ADRESSE + 5);
	const exterieur = await deposer({ db, corps: { sha256: 'c'.repeat(64) }, adresse: '198.51.100.1', maintenant: midi });
	assert.equal(exterieur.statut, 201, 'les actes de la glane ne prennent pas le plafond du jour des autres');
	assert.deepEqual((await bilanPublic({ db })).jours, [{ jour: '2026-10-15', depots: 1, deposants: 1 }]);
	await deposer({ db, corps: { sha256: 'd'.repeat(64) }, adresse: '198.51.100.2', maintenant: lendemain });
	assert.deepEqual((await bilanPublic({ db })).jours[0], { jour: '2026-10-15', depots: 1, deposants: 1 }, 'le jour clos garde le bilan hors flotte');
	assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM compte WHERE adresse = ?').get(CLE_DE_LA_FLOTTE).n, 0);
});

test('la glane ne redate pas un acte deja date pour sa commune et rend son recu', async () => {
	const db = baseDeTest();
	const premier = corpsDe(await glaner(db, acte(7)));
	const memeFichier = temoinDe(() => '7'.padStart(64, '0'));
	const r = await glaner(db, acte(8), { temoin: memeFichier });
	assert.equal(r.statut, 200);
	assert.deepEqual(corpsDe(r), { deja: true, jour: '2026-10-15', place: premier.place, id: premier.id });
	assert.equal((await serieDeLaCollectivite({ db, codes: ['17133'] })).total, 1);
});

test('la glane ne depose ni un acte hors du site officiel ni autre chose qu un acte', async () => {
	const db = baseDeTest();
	const hors = await glaner(db, acte(1, { collectivite: '17134' }));
	assert.equal(hors.statut, 422);
	assert.match(corpsDe(hors).erreur, /hors du site officiel/);
	const ordinaire = await glaner(db, { sha256: 'e'.repeat(64) });
	assert.equal(ordinaire.statut, 400);
	assert.match(corpsDe(ordinaire).details.join(), /que des actes/);
	assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM depot').get().n, 0);
});

test('la glane s arrete a son plafond du jour', async () => {
	const db = baseDeTest();
	db.sqlite.prepare('INSERT INTO compte (jour, adresse, n) VALUES (?, ?, ?)').run('2026-10-15', CLE_DE_LA_FLOTTE, ACTES_DE_LA_FLOTTE_PAR_JOUR);
	const r = await glaner(db, acte(1));
	assert.equal(r.statut, 429);
	assert.match(corpsDe(r).erreur, /plafond de la flotte/);
});
