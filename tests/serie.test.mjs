import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { idDuRecu, recuDe } from '../src/depot.mjs';
import { TYPE_DU_CERTIFICAT, estUnCertificat, finDeLAffichage, joursDAffichage, lireCertificat, verdictDuJour, verifierLeCertificat } from '../src/serie.mjs';

/*
 * Ce que ces tests defendent : le certificat d'une serie d'affichage (D-166)
 * se relit recu par recu contre les lignes publiques ; la periode se recalcule
 * depuis la pose, jamais lue dans le fichier ; un jour passe sans photo
 * interrompt la serie ; le numero du permis n'est dit relu que dans un recu
 * complet dont l'identifiant se recalcule.
 */

const PERMIS = 'PC 069 123 24 A0001';
const hex = (c) => c.repeat(64);

async function depotDu(jour, empreinte, permis = PERMIS) {
	const complet = JSON.parse(JSON.stringify(recuDe({ sha256: empreinte, instant: `${jour}T09:00:00Z`, affichage: { permis } })));
	const recu = await idDuRecu(complet);
	return { jour, sha256: empreinte, recu, complet };
}

const certificat = (jours, extra = {}) => ({ type: TYPE_DU_CERTIFICAT, version: 1, permis: PERMIS, pose: '2026-10-12', jours, ...extra });

/** Un registre simule : les lignes publiques de ces depots, a la place 1, 2, 3... */
const registre = (depots) => {
	const lignes = new Map(depots.map((d, i) => [d.recu, { sha256: d.sha256, jour: d.jour, place: i + 1, recu: d.recu }]));
	return async (id) => lignes.get(id) ?? null;
};

test('la periode : deux mois depuis la pose, au dernier jour du mois quand le quantieme manque', () => {
	assert.equal(finDeLAffichage('2026-10-12'), '2026-12-12');
	assert.equal(finDeLAffichage('2026-12-31'), '2027-02-28');
	assert.equal(finDeLAffichage('2027-12-31'), '2028-02-29');
	const jours = joursDAffichage('2026-10-12');
	assert.equal(jours.length, 62);
	assert.deepEqual([jours[0], jours.at(-1)], ['2026-10-12', '2026-12-12']);
});

test('un certificat se reconnait par son type, et se lit par sa forme', () => {
	assert.ok(estUnCertificat({ type: TYPE_DU_CERTIFICAT }));
	assert.ok(!estUnCertificat({ version: 3, sha256: hex('a') }));
	assert.ok(!estUnCertificat(null));
	const lu = lireCertificat(certificat([{ jour: '2026-10-12', sha256: hex('a'), recu: hex('b') }], { permis: 'pc069.123.24.a0001' }));
	assert.deepEqual(lu, { certificat: { permis: PERMIS, pose: '2026-10-12', fin: '2026-12-12', jours: [{ jour: '2026-10-12', sha256: hex('a'), recu: hex('b') }] } });
	assert.equal(lireCertificat(certificat([], { fin: '2026-12-12' })).certificat.fin, '2026-12-12');
});

test('un certificat mal forme dit son premier defaut', () => {
	const j = (jour, extra = {}) => ({ jour, sha256: hex('a'), recu: hex('b'), ...extra });
	const cas = [
		[{ version: 2 }, 'version'],
		[{ permis: 'panneau' }, 'permis'],
		[{ pose: '2026-02-30' }, 'pose'],
		[{ fin: '2026-11-12' }, 'fin'],
		[{ jours: 'tous' }, 'jours'],
		[{ jours: [j('2026-10-13', { sha256: 'court' })] }, 'jours'],
		[{ jours: [null] }, 'jours'],
		[{ jours: [j('2026-10-13', { complet: 'texte' })] }, 'jours'],
		[{ jours: [j('2026-10-11')] }, 'hors-periode'],
		[{ jours: [j('2026-12-13')] }, 'hors-periode'],
		[{ jours: [j('2026-10-14'), j('2026-10-13')] }, 'ordre'],
		[{ jours: [j('2026-10-13'), j('2026-10-13')] }, 'ordre']
	];
	for (const [extra, erreur] of cas) assert.deepEqual(lireCertificat(certificat([], extra)), { erreur }, erreur);
	assert.deepEqual(lireCertificat({ type: 'autre' }), { erreur: 'type' });
});

test('une serie continue en cours : chaque jour au registre, le numero relu, les jours suivants a venir', async () => {
	const depots = [await depotDu('2026-10-12', hex('1')), await depotDu('2026-10-13', hex('2')), await depotDu('2026-10-14', hex('3'))];
	const { certificat: c } = lireCertificat(certificat(depots));
	const b = await verifierLeCertificat(c, registre(depots), '2026-10-14');
	assert.equal(b.total, 62);
	assert.equal(b.auRegistre, 3);
	assert.equal(b.aVenir, 59);
	assert.equal(b.permisRelus, 3);
	assert.ok(b.conforme && b.continue);
	assert.equal(b.premierManque, null);
	assert.deepEqual(b.jours[1], { ...depots[1], place: 2, permis: 'relu', verdict: 'au-registre' });
});

test('un jour passe sans photo interrompt la serie, sans la rendre fausse', async () => {
	const depots = [await depotDu('2026-10-12', hex('1')), await depotDu('2026-10-14', hex('3'))];
	const { certificat: c } = lireCertificat(certificat(depots));
	const b = await verifierLeCertificat(c, registre(depots), '2026-10-15');
	assert.ok(b.conforme);
	assert.ok(!b.continue);
	assert.equal(b.sansPhoto, 2);
	assert.equal(b.premierManque, '2026-10-13');
});

test('sans recu complet, le jour est au registre et le numero du permis n est pas dit relu', async () => {
	const { complet, ...nu } = await depotDu('2026-10-12', hex('1'));
	assert.ok(complet);
	const v = await verdictDuJour(nu, { ...nu, place: 4 }, PERMIS);
	assert.deepEqual([v.verdict, v.permis, v.place], ['au-registre', 'non-relu', 4]);
});

test('un recu inconnu, une autre empreinte, un autre jour, un autre permis : refuses', async () => {
	const d = await depotDu('2026-10-12', hex('1'));
	const ligne = { sha256: d.sha256, jour: d.jour, place: 1, recu: d.recu };
	assert.equal((await verdictDuJour(d, null, PERMIS)).verdict, 'inconnu');
	assert.equal((await verdictDuJour(d, { ...ligne, sha256: hex('9') }, PERMIS)).verdict, 'different');
	assert.equal((await verdictDuJour(d, { ...ligne, jour: '2026-10-13' }, PERMIS)).verdict, 'different');
	assert.equal((await verdictDuJour(d, { ...ligne, recu: hex('8') }, PERMIS)).verdict, 'different');
	// Le recu d'un autre permis, ou un recu joint qui n'est pas celui de la ligne.
	const autre = await depotDu('2026-10-12', hex('1'), 'PC 075 056 25 B0002');
	assert.equal((await verdictDuJour({ ...autre }, { ...ligne, recu: autre.recu }, PERMIS)).verdict, 'autre-permis');
	assert.equal((await verdictDuJour({ ...d, complet: { ...d.complet, sel: 'f'.repeat(32) } }, ligne, PERMIS)).verdict, 'autre-permis');
	assert.equal((await verdictDuJour({ ...d, complet: { version: 3 } }, ligne, PERMIS)).verdict, 'autre-permis');
	const { certificat: c } = lireCertificat(certificat([d]));
	const b = await verifierLeCertificat(c, async () => null, '2026-10-12');
	assert.ok(!b.conforme);
	assert.equal(b.refuses, 1);
});

test('la page de verification reconnait un certificat avant un recu, et publie le module', () => {
	const verifier = fs.readFileSync(new URL('../public/verifier.js', import.meta.url), 'utf8');
	assert.match(verifier, /estUnCertificat\(r\)\) return verifierLaSerie/);
	assert.match(verifier, /from '\/serie\.mjs'/);
	const routes = JSON.parse(fs.readFileSync(new URL('../public/_routes.json', import.meta.url), 'utf8'));
	assert.ok(routes.exclude.includes('/serie.mjs'));
	assert.match(fs.readFileSync(new URL('../scripts/construire.mjs', import.meta.url), 'utf8'), /'serie\.mjs'\]/);
});
