import test from 'node:test';
import assert from 'node:assert/strict';
import { baseDeTest } from './d1.mjs';
import { PLATEFORMES, SITES_MIN, adresseDeSite, annuaireDesActifs, fragmentDe, fragments, sitesDe, sitesDeLaFiche, tableDesSites } from '../src/annuaire.mjs';
import { deposer } from '../src/service.mjs';

// Une fiche telle que l'export de l'annuaire la donne : les champs imbriques sont du JSON en texte.
const fiche = (insee, sites, siren = null, type = 'mairie') => ({
	code_insee_commune: insee,
	siren,
	site_internet: sites === null ? null : JSON.stringify(sites.map((valeur) => ({ libelle: '', valeur }))),
	pivot: JSON.stringify([{ type_service_local: type, code_insee_commune: [insee] }])
});
// Le plancher se franchit avec des communes fictives, chacune sur son propre domaine.
const remplissage = Array.from({ length: SITES_MIN }, (_, i) => fiche(`${String(30 + (i % 60)).padStart(2, '0')}${String(i % 1000).padStart(3, '0')}`, [`https://commune-${i}.fr/`]));

test('une fiche mairie donne ses sites, une autre fiche ou un site illisible rien', () => {
	assert.deepEqual(sitesDeLaFiche(fiche('17133', ['https://www.cravans.fr/'], '211701339')), [{ insee: '17133', siren: '211701339', hote: 'cravans.fr', chemin: '' }]);
	assert.deepEqual(sitesDeLaFiche(fiche('17133', ['cravans.fr/accueil/'], '211701338')), [{ insee: '17133', siren: null, hote: 'cravans.fr', chemin: '/accueil' }]);
	assert.deepEqual(sitesDeLaFiche(fiche('17133', ['https://www.cravans.fr/'], null, 'mairie_mairie_deleguee')), []);
	assert.deepEqual(sitesDeLaFiche(fiche('17133', null)), []);
	assert.deepEqual(sitesDeLaFiche(fiche('99999', ['https://x.fr/'])), []);
	assert.deepEqual(sitesDeLaFiche({ pivot: JSON.stringify([{ type_service_local: 'mairie', code_insee_commune: ['2A004'] }]), site_internet: [{ valeur: 'https://ajaccio.fr' }] }).map((s) => s.insee), ['2A004']);
	for (const v of ['', 'mailto:mairie@x.fr', 'localhost', 'https://u:p@x.fr/', 'http://[::1', null]) assert.equal(adresseDeSite(v), null, String(v));
});

test('un hote propre rattache tout son domaine ; un hote partage ou une plateforme, seulement le chemin de la commune', () => {
	const table = tableDesSites([
		...remplissage,
		fiche('17133', ['https://www.cravans.fr/'], '211701339'),
		fiche('50001', ['https://www.lahague.fr/communes-deleguees/acqueville']),
		fiche('50041', ['https://www.lahague.fr/']),
		fiche('50057', ['https://www.lahague.fr/']),
		fiche('37083', ['https://intramuros.org/courcoue']),
		fiche('37084', ['https://sites.google.com/']),
		fiche('76001', ['https://www.facebook.com/profile.php']),
		fiche('76002', ['https://www.facebook.com/profile.php'])
	]);
	assert.deepEqual(table['17133'], [['cravans.fr', '']]);
	assert.deepEqual(table['211701339'], [['cravans.fr', '']]);
	assert.deepEqual(table['50001'], [['lahague.fr', '/communes-deleguees/acqueville']]);
	assert.equal(table['50041'], undefined, 'la racine d un hote partage ne rattache personne');
	assert.deepEqual(table['37083'], [['intramuros.org', '/courcoue']]);
	assert.equal(table['37084'], undefined, 'la racine d une plateforme ne rattache personne');
	assert.equal(table['76001'], undefined, 'un meme chemin donne a deux communes ne rattache personne');
	assert.ok(PLATEFORMES.has('facebook.com'));
});

test('un export tronque est refuse', () => {
	assert.throws(() => tableDesSites(remplissage.slice(1)), /moins que 10000, export refuse/);
});

test('la table se coupe en fragments par departement ou par debut de SIREN, et se relit par fragment', async () => {
	assert.equal(fragmentDe('17133'), 'insee-17');
	assert.equal(fragmentDe('2A004'), 'insee-2A');
	assert.equal(fragmentDe('211701339'), 'siren-2117');
	const parts = fragments({ 17133: [['cravans.fr', '']], 211701339: [['cravans.fr', '']], 17134: [['x.fr', '']] });
	assert.deepEqual(Object.keys(parts).sort(), ['insee-17', 'siren-2117']);
	const lus = [];
	const env = {
		ASSETS: {
			fetch: async (url) => {
				lus.push(url.href);
				const part = parts[url.pathname.slice('/annuaire/'.length, -'.json'.length)];
				return part ? new Response(JSON.stringify(part)) : new Response('absent', { status: 404 });
			}
		}
	};
	const annuaire = annuaireDesActifs(env, 'https://empreintes.florianmousseau.com/api/depots');
	assert.deepEqual(await annuaire('17133'), [['cravans.fr', '']]);
	assert.equal(await annuaire('17999'), null);
	await assert.rejects(annuaire('2A004'), /annuaire : 404/);
	assert.equal(lus[0], 'https://empreintes.florianmousseau.com/annuaire/insee-17.json');
	assert.equal(await sitesDe('211701339', async () => new Response(JSON.stringify(parts['siren-2117']))).then((s) => s.length), 1);
});

test('seul un acte lu sur le site officiel entre dans la serie de sa collectivite', async () => {
	const db = baseDeTest();
	const midi = new Date('2026-10-12T12:00:00Z');
	const annuaire = async (code) => (code === '17133' ? [['cravans.fr', '']] : null);
	const deposerActe = (url, collectivite, adresse) =>
		deposer({ db, corps: { type: 'acte', url, collectivite, nature: 'arrete' }, adresse, maintenant: midi, annuaire, temoin: async () => ({ url, taille: 1, type: 'application/pdf', lu: midi.toISOString(), sha256: 'c'.repeat(64) }) });
	const officiel = JSON.parse((await deposerActe('https://www.cravans.fr/a.pdf', '17133', 'a')).corps);
	const declare = JSON.parse((await deposerActe('https://ailleurs.fr/a.pdf', '17133', 'b')).corps);
	assert.equal(declare.recu.acte.rattachement, 'declaree');
	assert.deepEqual(db.sqlite.prepare('SELECT recu, collectivite, nature FROM acte').all().map((r) => ({ ...r })), [{ recu: officiel.id, collectivite: '17133', nature: 'arrete' }]);
});
