import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ACTES, SCEAU, DONNEES_STRUCTUREES, PLAN, planDuSite, pageMentions, pageActe, pageCollectivite, pageEditeur, pageDocumentation, pageIntrouvable, ancrageDe, dateHeure, echapper, pageAccueil, pageDeposer, pageJournal, pageVerifier } from '../src/pages.mjs';

const t = { id: '20261012T101314Z', instant: '2026-10-12T10:13:14Z', objets: 2018, racine: 'f'.repeat(64), ots: 'bitcoin', bloc: 971045, fichiers: ['20261012T101314Z.json', '20261012T101314Z.racine.ots'] };
const pages = [pageJournal([t, { ...t, id: '20261012T121314Z', ots: 'calendrier', bloc: null }]), pageVerifier(), pageJournal([]), pageDeposer(), pageAccueil([t]), pageAccueil([]), pageIntrouvable(), pageMentions(), pageActe(), pageDocumentation(), pageEditeur({ flux: { id: '0123456789abcdef', inscrit: '2026-10-12T00:00:00Z', retire: null }, total: 1, versions: [{ article: 'e'.repeat(64), jour: '2026-10-12', place: 4, sha256: 'c'.repeat(64), recu: 'd'.repeat(64) }] }), pageCollectivite({ code: '17133', commune: { nom: 'Cravans', insee: '17133', siren: '211701339' }, serie: { total: 1, actes: [{ jour: '2026-10-12', place: 3, sha256: 'c'.repeat(64), recu: 'd'.repeat(64), nature: 'deliberation' }] } })];
const texteDe = (html) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, '');

test('aucun signe double ne suit une espace ordinaire dans le texte affiche', () => {
	for (const html of pages) {
		const texte = texteDe(html);
		assert.ok(texte.length > 40, 'le detecteur lit du texte');
		assert.deepEqual(texte.match(/[^\S\u00A0][:;?!»]/g), null);
	}
	assert.match(texteDe('<p>a :</p>'), / :/, 'le detecteur voit une espace ordinaire');
});

test("le nom de l'editeur est un lien vers son site", () => {
	for (const html of pages) assert.match(html, /<a href="https:\/\/florianmousseau.com">Florian Mousseau<\/a>/);
});

test("le journal affiche le dernier tour, son ancrage et ses fichiers", () => {
	assert.match(pages[0], /Bitcoin, bloc 971045/);
	assert.match(pages[0], /en cours d’inscription dans Bitcoin/);
	assert.match(pages[0], /href="\/empreintes\/20261012T101314Z.racine.ots">.ots</);
	assert.match(pages[2], /Aucun tour publié/);
});

test('les dates, les ancrages et les textes se rendent sans surprise', () => {
	assert.equal(dateHeure('2026-10-12T10:13:14Z'), '12/10/2026 10:13\u00A0UTC');
	assert.equal(ancrageDe({ ots: 'erreur' }), 'erreur');
	assert.equal(ancrageDe({ ots: null }), 'aucun');
	assert.equal(echapper('<a href="x">\'&'), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
});

test("l'accueil dit a quoi sert le service et mene aux deux gestes, sans le vocabulaire du journal", () => {
	const accueil = pages[4];
	assert.match(accueil, /<h1>Prouvez qu’un document existait à une date, sans modification.<\/h1>/);
	assert.match(accueil, /href="\/deposer"( aria-current="page")?>Dater</);
	assert.match(accueil, /id="zone"/, "l'accueil porte la zone de depot");
	assert.match(accueil, /<script type="module" src="\/deposer.js">/);
	assert.match(accueil, /2\u00A0018 dates enregistrées/);
	assert.match(accueil, /Le document ne quitte jamais votre appareil/);
	assert.ok(!texteDe(accueil).includes('documents publics'));
	const texte = texteDe(accueil.slice(accueil.indexOf('<main>')));
	for (const mot of ['racine', 'tour', 'ancrage', 'bloc', '.ots', 'miroir', 'SHA']) assert.ok(!texte.includes(mot), mot);
});

test('un acte porte un seul nom sur toutes les pages, et le menu ne garde que trois gestes', () => {
	for (const html of pages) {
		for (const acte of Object.values(ACTES)) {
			for (const m of html.matchAll(new RegExp(`href="${acte.chemin}"[^>]*>([^<]+)<`, 'g'))) assert.ok([acte.nom, acte.titre, acte.onglet].includes(m[1]), m[1]);
		}
		const menu = html.match(/<nav aria-label="Principal">(.*)<\/nav>/)[1];
		assert.deepEqual([...menu.matchAll(/>([^<]+)<\/a>/g)].map((m) => m[1]), ['Dater', 'Vérifier', 'Registre']);
	}
	assert.match(pages[1], /<a href="\/verifier" aria-current="page">Vérifier<\/a>/);
});

test('la marque porte son sceau, le meme que l icone', () => {
	const icone = readFileSync(new URL('../public/icone.svg', import.meta.url), 'utf8');
	for (const html of pages) assert.ok(html.includes(SCEAU));
	assert.ok(icone.includes(SCEAU.replace(/<svg[^>]*>/, '').replace('</svg>', '')), "l'icone dessine le sceau");
});

test('le choix du document est une zone de depot en francais, et les autres voies sont repliees', () => {
	for (const html of [pages[1], pages[3], pages[4]]) {
		assert.match(html, /<input type="file" id="fichier" class="masque">\n<label class="zone" for="fichier" id="zone">/);
		assert.match(html, /<span class="zone-titre">Déposez le document( à dater| ou son reçu)<\/span>/);
	}
	assert.match(pages[1], /<details>\n<summary>Pas le fichier sous la main\u00A0\?<\/summary>/);
	assert.match(pages[3], /<details>\n<summary>Pas le fichier sous la main\u00A0\? Donnez son lien.<\/summary>/);
	assert.match(pages[3], /<label for="url">Son lien \(adresse web\)<\/label>/);
});

test("le registre s'appelle Registre dans les liens et Registre des dates en titre, et dater dit ce qu'on recoit et ce qui est publie", () => {
	assert.equal(ACTES.journal.nom, 'Registre');
	assert.equal(ACTES.journal.titre, 'Registre des dates');
	for (const html of pages) assert.ok(!html.includes('Journal public'));
	assert.match(pages[0], /<h1>Registre des dates<\/h1>\n<p class="sous-titre">La liste publique des dates, sans les documents.<\/p>/);
	const dater = pages[3];
	assert.ok(dater.indexOf('reçu à imprimer ou à télécharger') > dater.indexOf('Dater ce document</button>'), 'la promesse suit le bouton, au plus pres');
	assert.match(dater, /Le document ne quitte jamais votre appareil/);
	assert.ok(!/qualifi/i.test(pages.join('')), 'le mot qualifie n apparait nulle part');
});

test('la documentation nomme chaque adresse servie et chaque formule', () => {
	const doc = pageDocumentation();
	for (const a of ['POST /api/depots', 'POST /api/flux', 'DELETE /api/flux/&lt;id&gt;', 'GET /depots/&lt;jour&gt;.jsonl', 'GET /api/recus/&lt;id&gt;', 'GET /api/depots/&lt;sha256&gt;', 'GET /api/bilan', 'GET /collectivite/&lt;INSEE&gt;', 'GET /health', 'depots:&lt;n&gt;', 'ots verify']) assert.ok(doc.includes(a), a);
	for (const html of pages) assert.match(html, /<a href="\/documentation">Documentation<\/a>/);
});

test('aucun gabarit non interpole ne s affiche', () => {
	for (const html of pages) assert.ok(!html.includes('${'), 'un ${...} est reste dans une chaine simple');
});

test("dater un acte demande l'adresse, la collectivite et la nature, et ne dit que ce que le recu prouve", () => {
	const html = pageActe();
	assert.equal(ACTES.acte.nom, 'Acte de collectivité');
	assert.equal(ACTES.acte.titre, 'Dater la mise en ligne d’un acte');
	assert.match(html, /<h1>Dater la mise en ligne d’un acte<\/h1>/);
	for (const id of ['url', 'collectivite', 'nature', 'libelle']) assert.match(html, new RegExp(`id="${id}"`), id);
	assert.match(html, /<option value="deliberation">Délibération<\/option><option value="arrete">Arrêté<\/option><option value="decision">Décision<\/option>/);
	assert.match(html, /ce fichier était en ligne à cette adresse à cet instant/);
	assert.ok(html.indexOf('reçu à imprimer ou à télécharger') > html.indexOf('Dater cet acte</button>'));
	assert.match(html, /Lien du fichier de l’acte \(le PDF\)/);
	for (const html of [pageDeposer(), pages[4]]) assert.match(html, /<div class="onglets"><span aria-current="page">Un document<\/span><a href="\/acte">Un acte de collectivité<\/a><\/div>/, "l'acte se choisit au premier ecran");
	assert.match(html, /<div class="onglets"><a href="\/deposer">Un document<\/a><span aria-current="page">Un acte de collectivité<\/span><\/div>/);
	assert.match(html, /<a href="\/deposer" aria-current="page">Dater<\/a>/, 'dater un acte reste sous Dater dans le menu');
	assert.ok(!/servi/.test(texteDe(html) + readFileSync(new URL('../public/deposer.js', import.meta.url), 'utf8')), 'un mot de tous les jours');
	assert.ok(!html.includes('id="fichier"'), 'un acte ne se date que par son adresse');
	for (const page of pages) assert.match(page, /<a href="\/acte">Acte de collectivité<\/a>/);
	const tout = [...pages, readFileSync(new URL('../public/deposer.js', import.meta.url), 'utf8')].join('');
	for (const interdit of [/vaut publication/i, /certifi/i, /qualifi/i]) assert.doesNotMatch(tout, interdit);
});

test('chaque page porte la marque, son adresse canonique et ses balises de partage', () => {
	for (const html of pages) {
		assert.match(html, /<title>[^<]+ \| Témoin public<\/title>/);
		assert.match(html, /<link rel="canonical" href="https:\/\/temoinpublic.fr\//);
		assert.match(html, /<meta property="og:title" content="[^"]+ \| Témoin public">/);
	}
});

test("seul l'accueil decrit le service en JSON-LD, gratuit et sans balise fermante possible", () => {
	assert.equal(pages.filter((html) => html.includes('application/ld+json')).length, 2);
	const bloc = pages[4].match(/<script type="application\/ld\+json">(.*)<\/script>/)[1];
	assert.deepEqual(JSON.parse(bloc), DONNEES_STRUCTUREES);
	assert.equal(DONNEES_STRUCTUREES.offers.price, '0');
});

test('le plan du site liste chaque page statique sur le domaine', () => {
	const plan = planDuSite();
	assert.equal(plan.match(/<loc>/g).length, PLAN.length);
	assert.match(plan, /<loc>https:\/\/temoinpublic.fr\/mentions-legales<\/loc>/);
});

test("les mentions legales nomment l'editeur, l'hebergeur et ce qui est garde", () => {
	const html = pageMentions();
	assert.match(html, /Cloudflare, Inc\./);
	assert.match(html, /mailto:contact@florianmousseau.com/);
	assert.match(html, /Aucun cookie/);
});
