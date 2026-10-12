// Les pages de la surface. Elles affichent ; la methode vit dans le code.

import { NATURES } from './acte.mjs';

const NBSP = '\u00A0';
const ADRESSE = 'https://temoinpublic.fr';
const DEPOT = 'https://github.com/florianmousseau/empreintes';
export const MARQUE = 'Témoin public';

/** Les trois actes du site, chacun sous un seul nom partout. */
export const ACTES = {
	dater: { chemin: '/deposer', nom: 'Dater un document' },
	verifier: { chemin: '/verifier', nom: 'Vérifier un document' },
	journal: { chemin: '/journal', nom: 'Registre des dates' },
	acte: { chemin: '/acte', nom: 'Dater un acte' },
	documentation: { chemin: '/documentation', nom: 'Documentation' },
	mentions: { chemin: '/mentions-legales', nom: 'Mentions légales' }
};

/** Les pages statiques que les moteurs lisent, dans l'ordre du plan du site. */
export const PLAN = ['/', ACTES.dater.chemin, ACTES.verifier.chemin, ACTES.acte.chemin, ACTES.journal.chemin, ACTES.documentation.chemin, ACTES.mentions.chemin];

/** Le plan du site, au format sitemaps.org. */
export const planDuSite = (chemins = PLAN) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${chemins.map((c) => `<url><loc>${ADRESSE}${c}</loc></url>`).join('\n')}
</urlset>
`;

/** Le service decrit pour les moteurs : gratuit, sans compte, en francais. */
export const DONNEES_STRUCTUREES = {
	'@context': 'https://schema.org',
	'@type': 'WebApplication',
	name: MARQUE,
	url: `${ADRESSE}/`,
	description: "Prouver gratuitement qu'un document existait à une date, sans modification : son empreinte est inscrite dans un registre public ancré dans Bitcoin.",
	applicationCategory: 'UtilitiesApplication',
	operatingSystem: 'Web',
	inLanguage: 'fr',
	isAccessibleForFree: true,
	offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
	author: { '@type': 'Person', name: 'Florian Mousseau', url: 'https://florianmousseau.com' }
};

/** Un bloc JSON-LD sur, meme si une chaine contient `</script>`. */
const jsonLd = (objet) => `<script type="application/ld+json">${JSON.stringify(objet).replace(/</g, '\\u003c')}</script>\n`;

/** Echappe un texte pour le HTML. */
export const echapper = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const nombre = (n) => n.toLocaleString('fr-FR').replace(/\u202f/g, NBSP);
const lien = (acte, classe = '') => `<a${classe ? ` class="${classe}"` : ''} href="${ACTES[acte].chemin}">${ACTES[acte].nom}</a>`;

/** Un instant ISO en « 12/10/2026 10:13 UTC ». */
export function dateHeure(iso) {
	const [j, h] = iso.split('T');
	return `${j.split('-').reverse().join('/')} ${h.slice(0, 5)}${NBSP}UTC`;
}

/** L'ancrage d'un tour, en clair, avec le lien du bloc quand il existe. */
export function ancrageDe(t) {
	if (t.ots === 'bitcoin' && t.bloc) return `<a href="https://mempool.space/block/${t.bloc}">Bitcoin, bloc ${t.bloc}</a>`;
	if (t.ots === 'calendrier') return 'en cours d’inscription dans Bitcoin';
	return t.ots ? echapper(t.ots) : 'aucun';
}

const LIBELLE = { json: 'relevé', racine: 'racine', 'racine.ots': '.ots', 'racine.tsr': '.tsr' };
const liensDe = (t) =>
	t.fichiers.map((f) => `<a href="/empreintes/${echapper(f)}">${LIBELLE[f.slice(t.id.length + 1)] ?? echapper(f)}</a>`).join(' ');

/** Le choix d'un fichier, en francais : le bouton natif parle la langue du navigateur. */
export const choixDeFichier = (texte) => `<div class="choix">
<label class="bouton" for="fichier">${texte}</label>
<input type="file" id="fichier" class="masque">
<span id="nom-fichier">Aucun document choisi</span>
</div>`;

function gabarit({ titre, description, chemin, corps, script = '', indexer = true, structure = null }) {
	const titreComplet = `${titre} | ${MARQUE}`;
	return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titreComplet}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${ADRESSE}${chemin}">${indexer ? '' : '\n<meta name="robots" content="noindex">'}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${MARQUE}">
<meta property="og:locale" content="fr_FR">
<meta property="og:title" content="${titreComplet}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${ADRESSE}${chemin}">
${structure ? jsonLd(structure) : ''}
<link rel="stylesheet" href="/style.css">
<link rel="icon" href="/icone.svg" type="image/svg+xml">
${script}</head>
<body>
<header><a class="marque" href="/">Témoin public</a><nav>${lien('dater')} ${lien('verifier')} ${lien('journal')}</nav></header>
<main>
${corps}
</main>
<footer>${lien('acte')}. ${lien('documentation')}. ${lien('mentions')}. Éditeur${NBSP}: <a href="https://florianmousseau.com">Florian Mousseau</a>. Code et journal${NBSP}: <a href="${DEPOT}">${DEPOT.replace('https://', '')}</a></footer>
</body>
</html>
`;
}

/** L'accueil : a quoi sert le service, et les deux gestes. */
export function pageAccueil(tours) {
	const dernier = tours.at(-1);
	const compte = dernier ? `<p class="compte">${nombre(dernier.objets)} dates enregistrées depuis le ${dateHeure(tours[0].instant).split(' ')[0]}.</p>` : '';
	return gabarit({
		titre: 'Prouver la date d’un document',
		description: "Prouvez gratuitement qu'un document existait à une date, sans modification. Sans compte ; seule son empreinte est publiée, jamais le document.",
		chemin: '/',
		structure: DONNEES_STRUCTUREES,
		corps: `<section class="une">
<h1>Prouvez qu’un document existait à une date, sans modification.</h1>
<p>Gratuit, sans compte. Seule son empreinte, un code de 64 caractères, est publiée${NBSP}: jamais le document.</p>
<p class="gestes">${lien('dater', 'bouton principal')} ${lien('verifier', 'bouton')}</p>
</section>
${compte}`
	});
}

/** Le journal public : les chiffres, la derniere racine, chaque tour, et la chaine. */
export function pageJournal(tours) {
	const dernier = tours.at(-1);
	const lignes = [...tours]
		.reverse()
		.map(
			(t) =>
				`<tr><td>${dateHeure(t.instant)}</td><td class="n">${nombre(t.objets)}</td><td class="large"><code title="${t.racine}">${t.racine.slice(0, 16)}</code></td><td>${ancrageDe(t)}</td><td class="large">${liensDe(t)}</td></tr>`
		)
		.join('\n');
	const tete = dernier
		? `<dl class="chiffres">
<div><dt>Documents</dt><dd>${nombre(dernier.objets)}</dd></div>
<div><dt>Tours</dt><dd>${nombre(tours.length)}</dd></div>
<div><dt>Depuis le</dt><dd>${dateHeure(tours[0].instant).split(' ')[0]}</dd></div>
</dl>
<h2>Dernière racine, ${dateHeure(dernier.instant)}</h2>
<p><code class="racine">${dernier.racine}</code></p>
<p>${ancrageDe(dernier)}</p>`
		: '<p>Aucun tour publié.</p>';
	return gabarit({
		titre: ACTES.journal.nom,
		description: 'Chaque tour du journal des empreintes : documents, racine chaînée, ancrage Bitcoin, fichiers de preuve.',
		chemin: '/journal',
		script: '<script type="module" src="/verifier.js"></script>\n',
		corps: `<h1>${ACTES.journal.nom}</h1>
<p class="sous-titre">La liste publique des dates, sans les documents.</p>
${tete}
<p><button type="button" id="chaine">Vérifier la chaîne</button></p>
<div id="resultat-chaine" aria-live="polite"></div>
<h2>${nombre(tours.length)} tours</h2>
<table>
<thead><tr><th>Tour</th><th class="n">Documents</th><th class="large">Racine</th><th>Bitcoin</th><th class="large">Fichiers</th></tr></thead>
<tbody>
${lignes}
</tbody>
</table>
<p><a href="${DEPOT}/blob/main/scripts/verifier.mjs">Script de vérification</a></p>`
	});
}

const autresVoies = (champs, suite = '') => `<details>
<summary>Pas le fichier sous la main${NBSP}?${suite}</summary>
${champs}
</details>`;

/** Verifier : un document, ou son empreinte. */
export function pageVerifier() {
	return gabarit({
		titre: ACTES.verifier.nom,
		description: "Vérifier qu'un document est identique à celui qui a été daté, et à quelle date.",
		chemin: '/verifier',
		script: '<script type="module" src="/verifier.js"></script>\n',
		corps: `<h1>${ACTES.verifier.nom}</h1>
<form id="formulaire">
${choixDeFichier('Choisir le document ou son reçu')}
${autresVoies(`<label for="empreinte">Son empreinte SHA-256</label>
<input type="text" id="empreinte" autocomplete="off" spellcheck="false">`)}
<button type="submit" class="principal">Vérifier</button>
</form>
<div id="resultat" aria-live="polite"></div>`
	});
}

/** Dater : le fichier par defaut, les deux autres voies repliees. */
export function pageDeposer() {
	return gabarit({
		titre: ACTES.dater.nom,
		description: "Dater gratuitement un document, ancré dans Bitcoin, et recevoir un reçu à imprimer. Seule son empreinte est publiée, jamais le document.",
		chemin: '/deposer',
		script: '<script type="module" src="/deposer.js"></script>\n',
		corps: `<h1>${ACTES.dater.nom}</h1>
<form id="formulaire">
${choixDeFichier('Choisir le document')}
${autresVoies(`<label for="url">Son lien (adresse web)</label>
<input type="text" id="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://">
<label for="empreinte">Ou son empreinte SHA-256</label>
<input type="text" id="empreinte" autocomplete="off" spellcheck="false">`, ' Donnez son lien.')}
<label for="libelle">Un nom pour vous en souvenir (facultatif)</label>
<input type="text" id="libelle" maxlength="200" autocomplete="off">
<p class="recoit">Vous recevez un reçu à imprimer ou à télécharger, à garder avec le document. Seule son empreinte est publiée, jamais le document.</p>
<button type="submit" class="principal">Dater ce document</button>
</form>
<div id="resultat" aria-live="polite"></div>
<p class="compte">Gratuit, sans compte, jusqu’à 20 documents par jour. Valeur juridique${NBSP}: un élément de preuve, que le juge apprécie librement.</p>
<p class="compte">Un acte de collectivité${NBSP}? ${lien('acte')}</p>`
	});
}

/** Dater un acte de collectivite : l'adresse ou il est publie, la collectivite, la nature. */
export function pageActe() {
	const natures = Object.entries(NATURES)
		.map(([valeur, nom]) => `<option value="${valeur}">${nom[0].toUpperCase()}${nom.slice(1)}</option>`)
		.join('');
	return gabarit({
		titre: ACTES.acte.nom,
		description: "Dater la mise en ligne d'un acte d'une collectivité, délibération, arrêté ou décision : le service lit l'acte à son adresse et délivre un reçu.",
		chemin: ACTES.acte.chemin,
		script: '<script type="module" src="/deposer.js"></script>\n',
		corps: `<h1>${ACTES.acte.nom}</h1>
<form id="formulaire">
<label for="url">Lien du fichier de l’acte (le PDF)</label>
<input type="text" id="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://" required>
<label for="collectivite">Code INSEE de la commune, ou SIREN de la collectivité</label>
<input type="text" id="collectivite" inputmode="numeric" autocomplete="off" spellcheck="false" maxlength="11" required>
<label for="nature">Nature</label>
<select id="nature">${natures}</select>
<label for="libelle">Objet (facultatif)</label>
<input type="text" id="libelle" maxlength="200" autocomplete="off">
<p class="recoit">Vous recevez un reçu à imprimer ou à télécharger. Il atteste que ce fichier était en ligne à cette adresse à cet instant.</p>
<button type="submit" class="principal">Dater cet acte</button>
</form>
<div id="resultat" aria-live="polite"></div>
<p class="compte">Gratuit, sans compte, jusqu’à 20 actes par jour. Un autre document${NBSP}? ${lien('dater')}</p>`
	});
}

const jourFr = (j) => j.split('-').reverse().join('/');

const majuscule = (t) => `${t[0].toUpperCase()}${t.slice(1)}`;
const marqueDuPluriel = (n) => (n > 1 ? 's' : '');

/** Le titre d'une serie : le compte et la nature. */
const titreDeSerie = (n) => (n ? `${nombre(n)} acte${marqueDuPluriel(n)} daté${marqueDuPluriel(n)}` : 'Aucun acte daté');

/** La ligne qui dit qu'une serie est coupee, vide sinon. */
const coupe = (serie) => (serie.total > serie.actes.length ? `<p class="compte">Les ${nombre(serie.actes.length)} plus récents sur ${nombre(serie.total)}.</p>` : '');

/** L'objet d'un acte, lie a l'acte en ligne quand son adresse est connue. */
const objetDe = (a) => {
	const objet = a.objet ? echapper(a.objet) : 'Sans objet';
	return a.url ? `<a href="${echapper(a.url)}">${objet}</a>` : objet;
};

/** La serie d'une collectivite : ses actes lus sur son site officiel, chacun avec son reçu. */
export function pageCollectivite({ code, commune, serie }) {
	const nom = commune ? echapper(commune.nom) : `Collectivité ${code}`;
	const codes = commune?.siren ? `Code INSEE ${code}, SIREN ${commune.siren}` : `Code ${code}`;
	const lignes = serie.actes
		.map(
			(a) =>
				`<tr><td>${jourFr(a.jour)}</td><td>${majuscule(NATURES[a.nature] ?? a.nature)}</td><td>${objetDe(a)}</td><td><a href="/recu/${a.recu}">Reçu</a></td></tr>`
		)
		.join('\n');
	const tableau = serie.actes.length
		? `<table>
<thead><tr><th>En ligne le</th><th>Nature</th><th>Objet</th><th>Preuve</th></tr></thead>
<tbody>
${lignes}
</tbody>
</table>
${coupe(serie)}`
		: '';
	return gabarit({
		titre: `${nom}, actes datés`,
		description: `Actes de ${nom} datés à leur adresse sur le site officiel de la commune${NBSP}: date de mise en ligne, nature, objet, reçu.`,
		chemin: `/collectivite/${code}`,
		indexer: serie.total > 0,
		corps: `<h1>${nom}</h1>
<p class="sous-titre">${codes}</p>
<h2>${titreDeSerie(serie.total)}</h2>
${tableau}
<p class="compte">Actes lus sur le site officiel de la commune.</p>
<p>${lien('acte', 'bouton principal')}</p>`
	});
}

/** Les lignes propres a un acte rattache, dans son reçu. */
const lignesDActe = (acte) =>
	acte
		? `<div><dt>Acte</dt><dd>${majuscule(NATURES[acte.nature] ?? acte.nature)}, ${objetDe(acte)}</dd></div>
<div><dt>Collectivité</dt><dd><a href="/collectivite/${echapper(acte.collectivite)}">${echapper(acte.collectivite)}</a></dd></div>
`
		: '';

/** Le recu d'un depot, a son adresse : ce que la ligne publique engage, et son inscription au registre. */
export function pageRecu(ligne, acte = null) {
	const tete = acte ? `En ligne le ${jourFr(ligne.jour)}` : `Document daté du ${jourFr(ligne.jour)}`;
	return gabarit({
		titre: `Reçu de date du ${jourFr(ligne.jour)}`,
		description: `Reçu de date${NBSP}: ${acte ? 'acte en ligne' : 'document daté'} le ${jourFr(ligne.jour)}, ligne ${ligne.place}.`,
		chemin: `/recu/${ligne.recu}`,
		script: '<script type="module" src="/recu.js"></script>\n',
		corps: `<h1>Reçu de date</h1>
<article class="ok" id="recu" data-recu="${ligne.recu}">
<h2>${tete}</h2>
<dl>
${lignesDActe(acte)}<div><dt>Empreinte</dt><dd><code class="racine">${ligne.sha256}</code></dd></div>
<div><dt>Ligne</dt><dd>${ligne.place} du ${jourFr(ligne.jour)}</dd></div>
<div><dt>Registre</dt><dd id="inscription">lecture du registre</dd></div>
</dl>
<p class="imprime">temoinpublic.fr/recu/${ligne.recu}</p>
</article>
<p class="gestes"><button type="button" id="imprimer" class="principal">Imprimer le reçu</button> ${lien('verifier', 'bouton')}</p>`
	});
}

/** Le registre public d'un editeur : chaque version datee de ses articles, sans adresse ni titre. */
export function pageEditeur({ flux, total, versions }) {
	const parArticle = new Map();
	for (const v of versions) parArticle.set(v.article, (parArticle.get(v.article) ?? 0) + 1);
	const lignes = versions
		.map(
			(v) =>
				`<tr><td><code>${v.article.slice(0, 12)}</code></td><td class="n">${parArticle.get(v.article)}</td><td><a href="/recu/${v.recu}">${jourFr(v.jour)}</a></td><td class="n">${v.place}</td><td class="large"><code title="${v.sha256}">${v.sha256.slice(0, 16)}</code></td></tr>`
		)
		.join('\n');
	const tableau = versions.length
		? `<table>
<thead><tr><th>Article</th><th class="n">Versions</th><th>Datée le</th><th class="n">Ligne</th><th class="large">Empreinte</th></tr></thead>
<tbody>
${lignes}
</tbody>
</table>
${coupeDesVersions(versions.length, total)}`
		: '';
	const etat = flux.retire ? `Suivi du ${jourFr(flux.inscrit.slice(0, 10))} au ${jourFr(flux.retire.slice(0, 10))}` : `Suivi depuis le ${jourFr(flux.inscrit.slice(0, 10))}`;
	return gabarit({
		titre: `Registre de l’éditeur ${flux.id}`,
		description: `Les versions datées des articles du flux ${flux.id}${NBSP}: date, ligne du registre, empreinte.`,
		chemin: `/editeur/${flux.id}`,
		indexer: total > 0,
		script: '<script type="module" src="/editeur.js"></script>\n',
		corps: `<h1>Registre de l’éditeur</h1>
<p class="sous-titre">Flux ${flux.id}. ${etat}.</p>
<h2>${titreDeVersions(parArticle.size, total)}</h2>
${tableau}
<section id="prive" data-flux="${flux.id}" hidden></section>`
	});
}

/** La ligne qui dit qu'un registre est coupe, vide sinon. */
const coupeDesVersions = (montrees, total) => (total > montrees ? `<p class="compte">Les ${nombre(montrees)} plus récentes sur ${nombre(total)}.</p>` : '');

const titreDeVersions = (articles, versions) =>
	versions ? `${nombre(versions)} version${marqueDuPluriel(versions)}, ${nombre(articles)} article${marqueDuPluriel(articles)}` : 'Aucune version datée';

/** Une adresse de recu qui ne nomme aucun depot. */
export function pageRecuInconnu() {
	return gabarit({
		titre: 'Reçu inconnu',
		description: 'Aucun dépôt ne porte ce reçu.',
		chemin: '/recu/',
		corps: `<h1>Reçu inconnu</h1>
<p>${lien('verifier', 'bouton')}</p>`
	});
}

/** Toute adresse sans page : un vrai 404, jamais l'accueil servi a la place d'un fichier absent. */
export function pageIntrouvable() {
	return gabarit({
		titre: 'Page introuvable',
		description: 'Aucune page à cette adresse.',
		chemin: '/404',
		corps: `<h1>Page introuvable</h1>
<p>${lien('dater', 'bouton principal')} ${lien('verifier', 'bouton')}</p>`
	});
}

const ligneDoc = (gauche, droite) => `<tr><td><code>${gauche}</code></td><td>${droite}</td></tr>`;
const tableDoc = (titre, lignes) => `<h2>${titre}</h2>
<table class="doc">
<tbody>
${lignes.join('\n')}
</tbody>
</table>`;

/** La documentation : les adresses, les limites et les formules, pour verifier sans ce site. */
export function pageDocumentation() {
	return gabarit({
		titre: ACTES.documentation.nom,
		description: 'Adresses, limites et formules du registre des dates : dater, lire et vérifier sans ce site.',
		chemin: ACTES.documentation.chemin,
		corps: `<h1>${ACTES.documentation.nom}</h1>
${tableDoc('Dater', [
	ligneDoc('POST /api/depots {"sha256": "&lt;64 hex&gt;", "libelle": "&lt;texte&gt;"}', 'une empreinte calculée par vous\u00A0; le libellé reste dans le reçu'),
	ligneDoc('POST /api/depots {"url": "https://&lt;adresse&gt;"}', 'le service lit lui-même le document en ligne et date ses octets'),
	ligneDoc('POST /api/depots {"type": "acte", "url": "https://&lt;adresse&gt;", "collectivite": "&lt;INSEE | SIREN&gt;", "nature": "deliberation | arrete | decision"}', 'un acte de collectivité, lu à son adresse\u00A0; reçu version 2, ligne publique inchangée'),
	ligneDoc('201', 'le reçu, son identifiant, la ligne publique'),
	ligneDoc('POST /api/flux {"url": "https://&lt;flux RSS ou Atom&gt;"}', 'suivre un flux\u00A0: chaque heure, chaque article nouveau ou modifié est lu et daté\u00A0; rend l’identifiant du flux et son jeton'),
	ligneDoc('GET /editeur/&lt;id&gt;', 'le registre public d’un flux\u00A0: chaque version datée, sans adresse ni titre\u00A0; avec <code>#&lt;jeton&gt;</code>, les adresses et les reçus'),
	ligneDoc('GET /api/flux/&lt;id&gt;', 'le registre privé d’un flux, <code>authorization: Bearer &lt;jeton&gt;</code>'),
	ligneDoc('DELETE /api/flux/&lt;id&gt;', 'cesser de suivre un flux, <code>authorization: Bearer &lt;jeton&gt;</code>\u00A0; les dates déjà enregistrées restent'),
	ligneDoc('429', `20 dépôts par jour et par adresse, 2${NBSP}000 par jour, <code>retry-after</code> jusqu’à minuit UTC`),
	ligneDoc('409', 'une même adresse en ligne lue une fois par jour'),
	ligneDoc('422', 'lecture impossible\u00A0: 20 Mo, 30 s, 5 redirections au plus, adresses publiques seulement')
])}
${tableDoc('Lire', [
	ligneDoc('GET /depots/&lt;jour&gt;.jsonl', 'les dépôts du jour, une ligne <code>{"sha256","jour","place","recu"}</code> par dépôt'),
	ligneDoc('GET /recu/&lt;id&gt;', 'la page d’un reçu'),
	ligneDoc('GET /api/recus/&lt;id&gt;', 'la ligne publique d’un reçu'),
	ligneDoc('GET /api/depots/&lt;sha256&gt;', 'les dépôts d’une empreinte'),
	ligneDoc('GET /collectivite/&lt;INSEE&gt;', 'les actes d’une commune lus sur son site officiel\u00A0: date, nature, empreinte, reçu\u00A0; le SIREN y renvoie'),
	ligneDoc('GET /annuaire/communes/insee-&lt;département&gt;.json', 'le nom de chaque commune, code INSEE ou SIREN vers <code>[nom, INSEE, SIREN]</code>'),
	ligneDoc('GET /annuaire/insee-&lt;département&gt;.json', 'les sites officiels des communes, code INSEE ou SIREN vers <code>[hôte, préfixe]</code>, d’après l’annuaire Service-Public'),
	ligneDoc('GET /api/bilan', 'dépôts et déposants distincts, jour par jour'),
	ligneDoc('GET /tours.json', 'les tours du registre'),
	ligneDoc('GET /empreintes/&lt;tour&gt;.json', 'le relevé d’un tour, avec <code>.racine</code>, <code>.racine.ots</code>, <code>.racine.tsr</code>'),
	ligneDoc('GET /empreintes/depots.jsonl', 'les dépôts lus par l’entrepôt, dans l’ordre de leur inscription'),
	ligneDoc('GET /health', 'l’état du registre publié')
])}
${tableDoc('Vérifier sans ce site', [
	ligneDoc('feuille', '<code>sha256(cle + "\\n" + sha256 + "\\n" + jour + "\\n")</code>'),
	ligneDoc('arbre', 'Merkle SHA-256 sur les octets des deux enfants\u00A0; un niveau impair double son dernier nœud'),
	ligneDoc('racine', '<code>sha256("entrepot\\n" + tour + "\\n" + précédente + "\\n" + arbre + "\\n")</code>\u00A0; le premier tour suit 64 zéros'),
	ligneDoc('depots:&lt;n&gt;', 'la feuille des dépôts\u00A0: <code>sha256</code> des <code>n</code> premières lignes de <code>depots.jsonl</code>, chacune suivie de <code>"\\n"</code>'),
	ligneDoc('reçu', 'identifiant\u00A0: <code>sha256</code> de sa forme canonique, clés triées, sans espace'),
	ligneDoc('Bitcoin', '<code>ots verify &lt;tour&gt;.racine.ots</code>'),
	ligneDoc('script', '<a href="https://github.com/florianmousseau/empreintes/blob/main/scripts/verifier.mjs">node scripts/verifier.mjs &lt;document | --chaine&gt;</a>')
])}`
	});
}

/** Les mentions legales : l'editeur, l'hebergeur, et ce que le service garde. */
export function pageMentions() {
	return gabarit({
		titre: ACTES.mentions.nom,
		description: `Éditeur, hébergeur et données conservées par ${MARQUE}.`,
		chemin: ACTES.mentions.chemin,
		corps: `<h1>${ACTES.mentions.nom}</h1>
<h2>Éditeur</h2>
<p><a href="https://florianmousseau.com">Florian Mousseau</a>, directeur de la publication. Contact${NBSP}: <a href="mailto:contact@florianmousseau.com">contact@florianmousseau.com</a></p>
<h2>Hébergeur</h2>
<p>Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, États-Unis.</p>
<h2>Données</h2>
<p>Aucun document n’est reçu ni conservé, seulement son empreinte. Le libellé et l’adresse d’un dépôt restent dans le reçu. L’adresse IP d’un déposant n’est jamais écrite${NBSP}: seul son haché salé du jour sert au plafond, et le sel est effacé le lendemain. Aucun cookie.</p>
<h2>Code</h2>
<p><a href="${DEPOT}">${DEPOT.replace('https://', '')}</a></p>`
	});
}
