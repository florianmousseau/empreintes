import test from 'node:test';
import assert from 'node:assert/strict';
import { baseDeTest } from './d1.mjs';
import { NATURES, estUnInsee, estUnSiren, hoteDe, lireActe, surSiteOfficiel } from '../src/acte.mjs';
import { idDuRecu, lireDemande, lireFichierDuJour, recuDe } from '../src/depot.mjs';
import { deposer, fichierDuJour } from '../src/service.mjs';

const midi = new Date('2026-10-12T12:00:00Z');
const corpsDe = (r) => JSON.parse(r.corps);
const acte = (autres = {}) => ({ type: 'acte', url: 'https://www.cravans.fr/wp-content/uploads/deliberation-12.pdf', collectivite: '17133', nature: 'deliberation', libelle: 'Budget primitif 2026', ...autres });

test('un code de collectivite est un INSEE a 5 caracteres ou un SIREN a cle de Luhn juste', () => {
	for (const c of ['17133', '01001', '2A004', '2B033', '97411', '98735']) assert.ok(estUnInsee(c), c);
	for (const c of ['20004', '00123', '99001', '1713', '171334', '2C004', 'ABCDE']) assert.ok(!estUnInsee(c), c);
	// Cravans (mairie) et la commune de Paris
	for (const c of ['211701339', '217500016']) assert.ok(estUnSiren(c), c);
	for (const c of ['211701338', '21170133', '2117013390', 'A11701339']) assert.ok(!estUnSiren(c), c);
});

test('la demande d un acte exige le temoin d URL, un code juste et une nature connue', () => {
	assert.deepEqual(lireDemande(acte()).demande, { url: acte().url, libelle: 'Budget primitif 2026', acte: { collectivite: '17133', nature: 'deliberation' } });
	assert.equal(lireDemande(acte({ collectivite: ' 2a004 ' })).demande.acte.collectivite, '2A004');
	assert.equal(lireDemande(acte({ collectivite: '211701339', nature: 'arrete' })).demande.acte.nature, 'arrete');
	const erreurs = (corps) => lireDemande(corps).erreurs?.join(' | ') ?? '';
	assert.match(erreurs(acte({ url: undefined, sha256: 'a'.repeat(64) })), /l url est requise.*pas de sha256 declare/);
	assert.match(erreurs({ type: 'acte', collectivite: '17133', nature: 'arrete' }), /l url est requise/);
	assert.doesNotMatch(erreurs({ type: 'acte', collectivite: '17133', nature: 'arrete' }), /l un des deux/);
	assert.match(erreurs(acte({ collectivite: '211701338' })), /collectivite : code commune INSEE/);
	assert.match(erreurs(acte({ collectivite: 17133 })), /collectivite/);
	assert.match(erreurs(acte({ nature: 'circulaire' })), /nature : deliberation, arrete, decision/);
	assert.match(erreurs(acte({ type: 'document' })), /type : "acte", "affichage" ou rien/);
	assert.match(erreurs({ url: 'https://x.fr/', collectivite: '17133' }), /seulement avec "type": "acte"/);
	assert.match(erreurs({ url: 'https://x.fr/', nature: 'arrete' }), /seulement avec "type": "acte"/);
	assert.deepEqual(Object.keys(NATURES), ['deliberation', 'arrete', 'decision']);
});

test("un acte se depose avec son objet, et l'objet ne nomme personne", () => {
	for (const libelle of [undefined, '', '   ']) assert.match(lireDemande(acte({ libelle })).erreurs.join(), /objet : requis pour un acte/);
	assert.doesNotMatch(lireDemande(acte({ libelle: '' })).erreurs.join(), /aucun nom de personne/);
	assert.match(lireDemande(acte({ libelle: 'Arrete de M. Dupont, maire' })).erreurs.join(), /aucun nom de personne/);
	assert.match(lireDemande(acte({ libelle: 'Permis accorde a Jean Martin' })).erreurs.join(), /aucun nom de personne/);
	assert.equal(lireDemande(acte({ libelle: 'Budget primitif 2026, rue Jean Jaures' })).demande.libelle, 'Budget primitif 2026, rue Jean Jaures');
	assert.equal(lireActe({ libelle: 'M. Dupont' }, []), null, 'hors acte, le controle ne s applique pas ici');
});

test('une adresse est sur le site officiel par son hote ou un sous-domaine, ou sous le prefixe d une plateforme', () => {
	const cravans = [['cravans.fr', '']];
	assert.equal(hoteDe('https://WWW.Cravans.fr./x'), 'cravans.fr');
	assert.ok(surSiteOfficiel('https://www.cravans.fr/actes/a.pdf', cravans));
	assert.ok(surSiteOfficiel('https://cravans.fr/a.pdf', cravans));
	assert.ok(surSiteOfficiel('https://docs.cravans.fr/a.pdf', cravans));
	assert.ok(!surSiteOfficiel('https://cravans.fr.exemple.com/a.pdf', cravans));
	assert.ok(!surSiteOfficiel('https://faux-cravans.fr/a.pdf', cravans));
	assert.ok(!surSiteOfficiel('pas une adresse', cravans));
	assert.ok(!surSiteOfficiel('https://cravans.fr/a.pdf', null));
	const plateforme = [['intramuros.org', '/courcoue']];
	assert.ok(surSiteOfficiel('https://intramuros.org/courcoue/actes/1.pdf', plateforme));
	assert.ok(surSiteOfficiel('https://www.intramuros.org/courcoue', plateforme));
	assert.ok(!surSiteOfficiel('https://intramuros.org/courcouel/1.pdf', plateforme));
	assert.ok(!surSiteOfficiel('https://intramuros.org/autre/1.pdf', plateforme));
	assert.ok(!surSiteOfficiel('https://x.intramuros.org/courcoue/1.pdf', plateforme));
});

const lu = { url: 'https://www.cravans.fr/wp-content/uploads/deliberation-12.pdf', taille: 3, type: 'application/pdf', lu: '2026-10-12T12:00:01.000Z', sha256: 'b'.repeat(64) };
const temoin = async () => lu;

test('un acte se depose par le temoin, sa ligne publique reste a quatre champs, son recu porte collectivite et nature', async () => {
	const db = baseDeTest();
	const r = await deposer({ db, corps: { ...acte(), libelle: 'Budget 2026' }, adresse: 'a', maintenant: midi, temoin });
	assert.equal(r.statut, 201);
	const { recu, id } = corpsDe(r);
	assert.equal(recu.version, 2);
	assert.equal(recu.source, 'temoin');
	assert.deepEqual(recu.acte, { collectivite: '17133', nature: 'deliberation', rattachement: 'declaree' });
	assert.equal(id, await idDuRecu(recu));
	const f = await fichierDuJour({ db, nom: '2026-10-12.jsonl', maintenant: midi });
	const [ligne] = lireFichierDuJour(f.corps, '2026-10-12');
	assert.deepEqual(Object.keys(ligne), ['sha256', 'jour', 'place', 'recu']);
	for (const prive of ['17133', 'deliberation', 'cravans', 'Budget']) assert.ok(!f.corps.includes(prive), prive);
	assert.throws(() => recuDe({ sha256: 'b'.repeat(64), instant: midi.toISOString(), acte: { collectivite: '17133' } }), /toujours lu par le temoin/);
});

test('un acte n est rattache que si l adresse demandee et l adresse lue sont sur le site officiel', async () => {
	const annuaire = async (code) => (code === '17133' ? [['cravans.fr', '']] : null);
	const rattachement = async (corps, l = lu) =>
		corpsDe(await deposer({ db: baseDeTest(), corps, adresse: 'a', maintenant: midi, temoin: async () => l, annuaire })).recu.acte.rattachement;
	assert.equal(await rattachement(acte()), 'site-officiel');
	assert.equal(await rattachement(acte({ collectivite: '17134' })), 'declaree', 'une autre commune ne se l attribue pas');
	assert.equal(await rattachement(acte({ url: 'https://depot-de-tiers.fr/a.pdf' }), { ...lu, url: 'https://depot-de-tiers.fr/a.pdf' }), 'declaree');
	assert.equal(await rattachement(acte(), { ...lu, url: 'https://ailleurs.fr/a.pdf' }), 'declaree', 'une redirection hors du site ne rattache pas');
	const enPanne = async () => {
		throw new Error('annuaire muet');
	};
	const r = await deposer({ db: baseDeTest(), corps: acte(), adresse: 'a', maintenant: midi, temoin, annuaire: enPanne });
	assert.equal(corpsDe(r).recu.acte.rattachement, 'declaree');
});
