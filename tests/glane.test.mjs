import test from 'node:test';
import assert from 'node:assert/strict';
import { SANS_OBJET, acteDuLien, liensDe, natureDe, normaliser, objetDe, pagesCandidates, pdfsDe, reglesRobots, robotsPermet, scoreDePage, texteDuHtml } from '../src/glane.mjs';

const ICI = 'https://www.ville-echillais.fr/';
const sites = [['ville-echillais.fr', '']];
const lien = (href, texte = '') => ({ href, texte });

test('les liens d une page sont absolus, sans ancre, avec leur texte ou leur titre', () => {
	const html = `
		<a href="/mairie/conseil-municipal/">Conseil <b>municipal</b></a>
		<a class="x" href='documents/PV%20du%2012-09.pdf' title="PV du 12 septembre"><img src="i.png"></a>
		<a href="#haut">Haut</a><a href="mailto:mairie@x.fr">Ecrire</a><a href="tel:05">Appeler</a>
		<a href="javascript:void(0)">Rien</a><a name="ancre">sans href</a>
		<a href="http://[::1">casse</a><a href="ftp://x.fr/a.pdf">ftp</a>
		<a href="https://autre.fr/page#s">D&eacute;lib&#233;rations &amp; arr&#xEA;t&eacute;s&nbsp;&inconnu;</a>`;
	assert.deepEqual(liensDe(html, `${ICI}mairie/`), [
		lien('https://www.ville-echillais.fr/mairie/conseil-municipal/', 'Conseil municipal'),
		lien('https://www.ville-echillais.fr/mairie/documents/PV%20du%2012-09.pdf', 'PV du 12 septembre'),
		lien('https://autre.fr/page', 'Délibérations & arrêtés &inconnu;')
	]);
	assert.equal(texteDuHtml('<p>Arr&ecirc;t&eacute;\n  du <i>maire</i></p>'), 'Arrêté du maire');
	assert.equal(normaliser('Délibération N’ 12'), "deliberation n' 12");
});

test('une page d actes se reconnait a son libelle ou son chemin, celle qui porte les actes avant celle du conseil', () => {
	assert.equal(scoreDePage(lien(`${ICI}x`, 'Les délibérations')), 3);
	assert.equal(scoreDePage(lien(`${ICI}publication-des-actes/`, 'Publications')), 3);
	assert.equal(scoreDePage(lien(`${ICI}x`, 'Arrêtés municipaux')), 3);
	assert.equal(scoreDePage(lien(`${ICI}x`, 'Comptes rendus')), 2);
	assert.equal(scoreDePage(lien(`${ICI}mairie/conseil-municipal-d-echillais/`, 'Le conseil')), 2);
	assert.equal(scoreDePage(lien(`${ICI}x`, 'Vie municipale')), 1);
	assert.equal(scoreDePage(lien(`${ICI}x`, "Demande d'acte de naissance")), 0);
	assert.equal(scoreDePage(lien(`${ICI}etat-civil/actes`, 'Actes')), 0);
	assert.equal(scoreDePage(lien(`${ICI}x`, 'Agenda')), 0);
	assert.equal(scoreDePage(lien(`${ICI}pages/arretes-de-m-le-prefet-.html`, 'Arrêtés de M. le Préfet')), 0, 'les arretes du prefet ne sont pas ceux de la commune');
	assert.equal(scoreDePage(lien(`${ICI}%E9`, 'Agenda')), 0, 'un chemin mal encode se lit tel quel');
	const liens = [
		lien(`${ICI}vie-municipale/`, 'Vie municipale'),
		lien(`${ICI}conseil/`, 'Le conseil municipal'),
		lien(`${ICI}deliberations/`, 'Délibérations'),
		lien(`${ICI}deliberations/`, 'Délibérations (doublon)'),
		lien(`${ICI}actes.pdf`, 'Délibérations PDF'),
		lien('https://autre.fr/deliberations/', 'Délibérations ailleurs'),
		lien(ICI, 'Accueil des délibérations')
	];
	assert.deepEqual(
		pagesCandidates(liens, { sites, ici: ICI }).map((l) => l.href),
		[`${ICI}deliberations/`, `${ICI}conseil/`]
	);
	assert.equal(pagesCandidates(liens, { sites, ici: ICI, plancher: 1, max: 5 }).length, 3);
	assert.equal(pagesCandidates(liens, { sites, ici: ICI, max: 1 }).length, 1);
});

test('les PDF retenus sont ceux du site officiel, une fois chacun', () => {
	const liens = [lien(`${ICI}a.pdf`, 'A'), lien(`${ICI}a.pdf`, 'A encore'), lien(`${ICI}B.PDF?v=2`, 'B'), lien('https://cdn.ailleurs.fr/c.pdf', 'C'), lien(`${ICI}page`, 'D')];
	assert.deepEqual(
		pdfsDe(liens, sites).map((l) => l.href),
		[`${ICI}a.pdf`, `${ICI}B.PDF?v=2`]
	);
});

test('la nature se lit dans le libelle, puis dans le nom du fichier, et ne se devine jamais', () => {
	assert.equal(natureDe(lien(`${ICI}1.pdf`, 'Arrêté n° 2026-12 portant circulation')), 'arrete');
	assert.equal(natureDe(lien(`${ICI}1.pdf`, 'Délibération portant arrêté du budget')), 'deliberation', 'le premier indice l emporte');
	assert.equal(natureDe(lien(`${ICI}1.pdf`, 'Procès-verbal de la séance du 12/09/2026')), 'deliberation');
	assert.equal(natureDe(lien(`${ICI}1.pdf`, 'Compte rendu du conseil')), 'deliberation');
	assert.equal(natureDe(lien(`${ICI}1.pdf`, 'Décision du maire 2026-3')), 'decision');
	assert.equal(natureDe(lien(`${ICI}PV_CM_2026-09-12.pdf`, 'Télécharger')), 'deliberation');
	assert.equal(natureDe(lien(`${ICI}arrete-voirie-12.pdf`, 'Voirie')), 'arrete');
	assert.equal(natureDe(lien(`${ICI}budget.pdf`, 'Budget 2026')), null);
	assert.equal(natureDe(lien(`${ICI}convocation-conseil.pdf`, 'Conseil municipal du 3 octobre')), null);
	assert.equal(natureDe(lien(`${ICI}cr.pdf`, 'Ordre du jour du conseil municipal')), null);
	assert.equal(natureDe(lien(`${ICI}bulletin.pdf`, 'Bulletin municipal')), null);
	assert.equal(natureDe(lien(`${ICI}ap.pdf`, 'Arrêté préfectoral sécheresse')), null, 'un arrete du prefet n est pas un acte de la commune');
	assert.equal(natureDe(lien(`${ICI}ap.pdf`, 'Arrêté préfectoral sécheresse')), null);
});

test('l objet est le libelle nettoye, sinon le nom du fichier, et ne nomme personne', () => {
	assert.equal(objetDe(lien(`${ICI}1.pdf`, 'Procès-verbal du 12/09/2026 (PDF, 245 Ko)')), 'Procès-verbal du 12/09/2026');
	assert.equal(objetDe(lien(`${ICI}1.pdf`, 'Télécharger le compte rendu - 1,2 Mo')), 'Compte rendu');
	assert.equal(objetDe(lien(`${ICI}docs/PV_conseil-municipal_12-09-2026.pdf`, 'Télécharger')), 'PV conseil municipal 12 09 2026');
	assert.equal(objetDe(lien(`${ICI}docs/deliberation-0a1b2c3d4e5f6a7b.pdf`, 'ici')), 'Deliberation');
	assert.equal(objetDe(lien(`${ICI}docs/arrete%20voirie.pdf`, 'pdf')), 'Arrete voirie');
	assert.equal(objetDe(lien(`${ICI}IMG/pdf/pv_cm_13122025.pdf`, 'PDF - 2.3 Mio')), 'Pv cm 13122025');
	assert.equal(objetDe(lien(`${ICI}CR-CM-08-12-2025.pdf`, 'Cliquez')), 'CR CM 08 12 2025');
	assert.equal(objetDe(lien(`${ICI}PV-12-03-2026.pdf`, 'Consulter le')), 'PV 12 03 2026');
	assert.equal(objetDe(lien(`${ICI}1.pdf`, 'Conseil Municipal du 22 mars 2026 V2. (464.09 k')), 'Conseil Municipal du 22 mars 2026 V2.');
	assert.equal(objetDe(lien(`${ICI}1.pdf`, 'Arrêté 15 mars 2026')), 'Arrêté 15 mars 2026');
	assert.equal(objetDe(lien(`${ICI}1.pdf`, 'Arrêté de M. Dupont, maire')), SANS_OBJET);
	assert.equal(objetDe(lien(`${ICI}0a1b2c3d4e5f6a7b8c9d.pdf`, '')), SANS_OBJET);
	assert.equal(objetDe(lien(`${ICI}1.pdf`, `Délibération ${'x'.repeat(300)}`)).length, 200);
	assert.deepEqual(acteDuLien(lien(`${ICI}pv.pdf`, 'PV du conseil')), { url: `${ICI}pv.pdf`, nature: 'deliberation', libelle: 'PV du conseil' });
	assert.equal(acteDuLien(lien(`${ICI}budget.pdf`, 'Budget')), null);
});

test('robots.txt : le groupe qui nomme la glane, sinon *, la regle la plus longue', () => {
	const texte = `# commentaire
User-agent: *
Disallow: /prive/
Crawl-delay: 10

User-agent: autrebot
User-agent: TemoinPublic/1.0
Disallow: /documents/*.pdf$
Allow: /documents/actes/
sans deux-points
`;
	const nous = reglesRobots(texte);
	assert.deepEqual(nous, [
		{ permis: false, motif: '/documents/*.pdf$' },
		{ permis: true, motif: '/documents/actes/' }
	]);
	assert.equal(robotsPermet(nous, `${ICI}documents/a.pdf`), false);
	assert.equal(robotsPermet(nous, `${ICI}documents/actes/a.pdf`), true, 'la plus longue l emporte');
	assert.equal(robotsPermet(nous, `${ICI}documents/a.pdf?x=1`), true, 'le $ ancre la fin');
	assert.equal(robotsPermet(nous, `${ICI}robots.txt`), true);
	const autres = reglesRobots(texte, 'inconnu');
	assert.equal(robotsPermet(autres, `${ICI}prive/a`), false);
	assert.equal(robotsPermet(autres, `${ICI}public/a`), true);
	assert.deepEqual(reglesRobots('User-agent: x\nDisallow: /'), []);
	const egalite = [
		{ permis: false, motif: '/a' },
		{ permis: true, motif: '/a' }
	];
	assert.equal(robotsPermet(egalite, `${ICI}a`), true);
	assert.equal(robotsPermet([{ permis: false, motif: '/a' }, { permis: true, motif: '/' }], `${ICI}a`), false);
});
