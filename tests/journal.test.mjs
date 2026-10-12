import test from 'node:test';
import assert from 'node:assert/strict';
import { FICHIER_PUBLIE, indexDesEmpreintes, instantDe, resumeDe, verdict } from '../src/journal.mjs';

const r1 = { id: '20261011T041935Z', precedente: '0', arbre: 'a', racine: 'r1', feuilles: [{ cle: 'src/x', sha256: 'aa11', jour: '2026-10-10' }, { cle: 'manifeste:2026-10-11', sha256: 'bb22', jour: '2026-10-11' }] };
const r2 = { id: '20261012T101314Z', precedente: 'r1', arbre: 'b', racine: 'r2', feuilles: [{ cle: 'src/x', sha256: 'aa11', jour: '2026-10-10' }, { cle: 'src/y', sha256: 'aa11', jour: '2026-10-12' }, { cle: 'liste:z', sha256: 'cc33', jour: '2026-10-12' }] };

test("l'instant d'un tour se lit sur son identifiant ; un identifiant illisible leve", () => {
	assert.equal(instantDe('20261012T101314Z'), '2026-10-12T10:13:14Z');
	assert.throws(() => instantDe('hier'), /illisible/);
});

test('seuls les fichiers du journal se publient, jamais le cache ni une sauvegarde', () => {
	for (const f of ['20261012T101314Z.json', '20261012T101314Z.racine', '20261012T101314Z.racine.ots', '20261012T101314Z.racine.tsr', 'ancrages.json']) assert.ok(FICHIER_PUBLIE.test(f), f);
	for (const f of ['20261012T101314Z.racine.ots.bak', 'cache', '../etat.json', 'x.json']) assert.ok(!FICHIER_PUBLIE.test(f), f);
});

test("l'index garde chaque cle d'une empreinte, son jour, son premier et son dernier tour, sans manifestes ni listes", () => {
	const index = indexDesEmpreintes([r1, r2]);
	assert.deepEqual(Object.keys(index), ['aa']);
	assert.deepEqual(index.aa.aa11, [
		{ cle: 'src/x', jour: '2026-10-10', premier: r1.id, dernier: r2.id },
		{ cle: 'src/y', jour: '2026-10-12', premier: r2.id, dernier: r2.id }
	]);
});

test('le resume compte les objets et nomme les fichiers du tour', () => {
	const t = resumeDe(r2, { ots: 'bitcoin', bloc: 971045, horodatage: { etat: 'fait' } }, ['20261012T101314Z.racine.ots', '20261012T101314Z.json', 'ancrages.json']);
	assert.equal(t.objets, 2);
	assert.equal(t.feuilles, 3);
	assert.equal(t.bloc, 971045);
	assert.equal(t.horodatage, 'fait');
	assert.deepEqual(t.fichiers, ['20261012T101314Z.json', '20261012T101314Z.racine.ots']);
	assert.equal(resumeDe(r1, undefined, []).ots, null);
});

const tour = (instant, ots = 'bitcoin') => ({ id: instant.replace(/[-:]/g, ''), instant, ots });
const maintenant = new Date('2026-10-12T12:00:00Z');

test('la sonde est ok sur un tour recent ancre', () => {
	assert.deepEqual(verdict([tour('2026-10-12T10:00:00Z')], maintenant), { alerte: 'ok', constats: [] });
});

test('la sonde passe attention au-dela de 12 h sans tour, rouge au-dela de 36 h, rouge sans aucun tour', () => {
	assert.equal(verdict([tour('2026-10-11T22:00:00Z')], maintenant).alerte, 'attention');
	assert.equal(verdict([tour('2026-10-10T20:00:00Z')], maintenant).alerte, 'rouge');
	assert.equal(verdict([], maintenant).alerte, 'rouge');
});

test("une preuve restee aux calendriers plus de 48 h est un constat ; une recente ne l'est pas", () => {
	const v = verdict([tour('2026-10-09T10:00:00Z', 'calendrier'), tour('2026-10-12T10:00:00Z', 'calendrier')], maintenant);
	assert.equal(v.alerte, 'attention');
	assert.equal(v.constats.length, 1);
	assert.equal(verdict([tour('2026-10-09T10:00:00Z', null), tour('2026-10-10T10:00:00Z')], maintenant).alerte, 'rouge');
});

test('une copie suspendue dit attention et la nomme, sans passer rouge sur un journal vieux', () => {
	const copie = { etat: 'suspendue', depuis: '2026-10-12' };
	const v = verdict([tour('2026-10-01T10:00:00Z', 'calendrier')], maintenant, copie);
	assert.equal(v.alerte, 'attention');
	assert.deepEqual(v.constats, ['copie du journal suspendue depuis le 2026-10-12 : dernier tour publie 20261001T100000Z']);
	assert.equal(verdict([], maintenant, copie).alerte, 'rouge');
	assert.equal(verdict([tour('2026-10-12T10:00:00Z')], maintenant, { etat: 'active' }).alerte, 'ok');
});
