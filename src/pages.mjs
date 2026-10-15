// Les pages de la surface. Elles affichent ; la methode vit dans le code. Chaque
// page se rend dans la langue d'une edition (`src/edition.mjs`), le francais par
// defaut ; les actes de collectivite ne se rendent qu'en francais.

import { NATURES } from './acte.mjs';
import { cheminDeLActe } from './adresse.mjs';
import { nomDuDepartement } from './departements.mjs';
import { BESOINS } from './besoins.mjs';
import { EDITIONS, cheminsDe, planDe } from './edition.mjs';
import { ADRESSES, FORMULES } from './documentation.mjs';

const NBSP = '\u00A0';
const DEPOT = 'https://github.com/temoinpublic/empreintes';
export const MARQUE = EDITIONS.fr.marque;

/** Les actes du site en francais : un nom court pour chaque lien, partout, et le titre de sa page. */
export const ACTES = EDITIONS.fr.actes;

/** Les pages statiques francaises que les moteurs lisent, dans l'ordre du plan du site. */
export const PLAN = planDe('fr');

/** Le plan du site d'une edition, au format sitemaps.org. */
export const planDuSite = (chemins = PLAN, langue = 'fr') => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${chemins.map((c) => `<url><loc>${EDITIONS[langue].adresse}${c}</loc></url>`).join('\n')}
</urlset>
`;

/** Les consignes aux robots d'une edition : tout, sauf l'index des empreintes, et ses plans (les communes et les actes, en francais). */
export const robots = (langue = 'fr') => `User-agent: *
Allow: /
Disallow: /index/

Sitemap: ${EDITIONS[langue].adresse}/sitemap.xml
${EDITIONS[langue].actes.communes ? `Sitemap: ${EDITIONS[langue].adresse}/sitemap-communes.xml\nSitemap: ${EDITIONS[langue].adresse}/sitemap-actes.xml\n` : ''}`;

/** Le service decrit pour les moteurs : gratuit, sans compte, dans la langue de l'edition. */
export const donneesStructurees = (langue = 'fr') => {
	const e = EDITIONS[langue];
	return {
		'@context': 'https://schema.org',
		'@type': 'WebApplication',
		name: e.marque,
		url: `${e.adresse}/`,
		description: e.structure.description,
		applicationCategory: 'UtilitiesApplication',
		operatingSystem: 'Web',
		inLanguage: langue,
		isAccessibleForFree: true,
		offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }
	};
};
export const DONNEES_STRUCTUREES = donneesStructurees('fr');

/** Un bloc JSON-LD sur, meme si une chaine contient `</script>`. */
const jsonLd = (objet) => `<script type="application/ld+json">${JSON.stringify(objet).replace(/</g, '\\u003c')}</script>\n`;

/** Echappe un texte pour le HTML. */
export const echapper = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const lien = (e, acte, classe = '') => `<a${classe ? ` class="${classe}"` : ''} href="${e.actes[acte].chemin}">${e.actes[acte].nom}</a>`;

/** Un instant ISO en « 12/10/2026 10:13 UTC ». */
export const dateHeure = (iso, langue = 'fr') => EDITIONS[langue].dateHeure(iso);

/** L'ancrage d'un tour, en clair, avec le lien du bloc quand il existe. */
export function ancrageDe(t, langue = 'fr') {
	const a = EDITIONS[langue].ancrage;
	if (t.ots === 'bitcoin' && t.bloc) return `<a href="https://mempool.space/block/${t.bloc}">${a.bitcoin(t.bloc)}</a>`;
	if (t.ots === 'calendrier') return a.calendrier;
	return t.ots ? echapper(t.ots) : a.aucun;
}

const liensDe = (e, t) =>
	t.fichiers.map((f) => `<a href="/empreintes/${echapper(f)}">${e.fichiers[f.slice(t.id.length + 1)] ?? echapper(f)}</a>`).join(' ');

/** Le sceau de la marque, dessine a la main : un cachet et sa coche. */
export const SCEAU = `<svg class="sceau" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="#b42318"/><circle cx="16" cy="16" r="11.6" fill="none" stroke="#fff" stroke-width="1.1" stroke-dasharray="1.8 1.5"/><path d="M10.6 16.4l3.7 3.7 7.2-7.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const ICONE_DOCUMENT = `<svg class="zone-icone" viewBox="0 0 48 48" aria-hidden="true"><path d="M13 5h15l10 10v26a2 2 0 0 1-2 2H13a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M28 5v10h10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M24 35V22m-5.5 5.5L24 22l5.5 5.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** La zone de depot : glisser le document, ou le choisir ; le bouton natif parle la langue du navigateur. */
export const choixDeFichier = (texte, langue = 'fr') => `<input type="file" id="fichier" class="masque">
<label class="zone" for="fichier" id="zone">
${ICONE_DOCUMENT}
<span class="zone-titre">${texte}</span>
<span class="zone-aide"><span class="souris">${EDITIONS[langue].zone.glisser}</span><span class="lien">${EDITIONS[langue].zone.choisir}</span></span>
<span id="nom-fichier" class="zone-nom">${EDITIONS[langue].zone.aucun}</span>
</label>`;

/** Les gestes du menu, le courant marque pour les lecteurs d'ecran ; dater un acte reste dater, une page de commune reste Communes. */
const navigation = (e, chemin) => {
	const communes = e.actes.communes?.chemin;
	let courant = chemin === e.actes.acte?.chemin ? e.actes.dater.chemin : chemin;
	if (communes && chemin.startsWith(`${communes}/`)) courant = communes;
	return ['dater', 'verifier', 'communes', 'journal']
		.filter((a) => e.actes[a])
		.map((a) => `<a href="${e.actes[a].chemin}"${e.actes[a].chemin === courant ? ' aria-current="page"' : ''}>${e.actes[a].nom}</a>`)
		.join(' ');
};

/** Les liens hreflang d'une page qui existe dans chaque edition ; `x-default` sur le francais. */
const alternatives = (chemins) =>
	chemins
		? Object.entries(chemins)
				.concat([['x-default', chemins.fr]])
				.map(([l, c]) => `\n<link rel="alternate" hreflang="${l}" href="${EDITIONS[l === 'x-default' ? 'fr' : l].adresse}${c}">`)
				.join('')
		: '';

function gabarit(e, { titre, description, chemin, corps, script = '', indexer = true, structure = null, chemins = null }) {
	const titreComplet = `${titre} | ${e.marque}`;
	return `<!doctype html>
<html lang="${e.langue}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titreComplet}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${e.adresse}${chemin}">${alternatives(chemins)}${indexer ? '' : '\n<meta name="robots" content="noindex">'}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${e.marque}">
<meta property="og:locale" content="${e.locale}">
<meta property="og:title" content="${titreComplet}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${e.adresse}${chemin}">
${structure ? jsonLd(structure) : ''}
<link rel="stylesheet" href="/style.css">
<link rel="icon" href="/icone.svg" type="image/svg+xml">
${script}</head>
<body>
<header><div class="barre"><a class="marque" href="/">${SCEAU}<span>${e.marque}</span></a><nav aria-label="${e.navigation}">${navigation(e, chemin)}</nav></div></header>
<main>
${corps}
</main>
<footer><div class="pied">
<p class="pied-marque">${SCEAU}<span>${e.marque}</span></p>
<p class="pied-liens">${lien(e, 'dater')} ${lien(e, 'verifier')} ${lien(e, 'journal')}${e.actes.communes ? ` ${lien(e, 'communes')}` : ''} ${lien(e, 'preuve')} ${lien(e, 'documentation')} ${lien(e, 'mentions')} <a href="${DEPOT}">${e.codeSource}</a></p>
</div></footer>
</body>
</html>
`;
}

/** Les conditions, lues avant tout depot (ETSI EN 319 401, 6.2). */
const accepterConditions = (e) => `<p class="recoit">${e.formulaire.accepter} ${lien(e, 'conditions')}.</p>`;

const champEmpreinte = (e) => `<details>
<summary>${e.empreinte.question}</summary>
<label for="empreinte">${e.empreinte.libelle}</label>
<input type="text" id="empreinte" autocomplete="off" spellcheck="false">
</details>`;

const optionsDeNature = () =>
	Object.entries(NATURES)
		.map(([valeur, nom]) => `<option value="${valeur}">${majuscule(nom)}</option>`)
		.join('');

/** Le bloc qui s'ouvre quand le lien est sur le site officiel d'une commune : il en fait un acte. Francais seulement. */
const blocActe = (e) =>
	e.actes.acte
		? `<div id="acte" class="acte" hidden>
<p class="acte-titre">Un acte de <strong id="acte-commune"></strong>${NBSP}?</p>
<input type="hidden" id="collectivite">
<label for="nature">Nature</label>
<select id="nature"><option value="">Non, un autre document</option>${optionsDeNature()}</select>
<label for="objet">Objet de l’acte</label>
<input type="text" id="objet" maxlength="200" autocomplete="off">
<p class="avertir">À faire le jour de la mise en ligne${NBSP}: le reçu porte le jour où vous cliquez.</p>
</div>
`
		: '';

/**
 * Le formulaire de datation, le meme a l'accueil et sur sa page : un fichier, ou
 * un lien ; un lien sur le site d'une commune propose d'en faire un acte.
 * L'empreinte nue hors de l'accueil.
 */
const formulaireDater = (e, avecEmpreinte = true) => `<form id="formulaire" class="carte">
${choixDeFichier(e.formulaire.deposez, e.langue)}
<p id="deja" class="deja" aria-live="polite" hidden></p>
<p class="ou"><span>${e.formulaire.ou}</span></p>
<label for="url">${e.formulaire.lien}</label>
<input type="text" id="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="${e.formulaire.exemple}">
${blocActe(e)}<details>
<summary>${e.formulaire.nommer}</summary>
<label for="libelle">${e.formulaire.nom}</label>
<input type="text" id="libelle" maxlength="200" autocomplete="off">
</details>
${avecEmpreinte ? champEmpreinte(e) : ''}
<button type="submit" class="principal large-bouton">${e.formulaire.bouton}</button>
<p class="recoit">${e.formulaire.recoit}</p>
${accepterConditions(e)}
</form>
<div id="resultat" aria-live="polite"></div>`;

const etapes = (e) => `<ol class="etapes">
${e.etapes.map(([geste, exemple]) => `<li><strong>${geste}</strong><span>${exemple}</span></li>`).join('\n')}
</ol>`;

/** L'accueil : le geste de dater, tout de suite. */
export function pageAccueil(tours, langue = 'fr') {
	const e = EDITIONS[langue];
	const dernier = tours.at(-1);
	const compte = dernier ? `<p class="compte">${e.accueil.compte(dernier.objets, e.jour(tours[0].instant.slice(0, 10)))}</p>` : '';
	return gabarit(e, {
		titre: e.accueil.titre,
		description: e.accueil.description,
		chemin: '/',
		chemins: cheminsDe('accueil'),
		structure: donneesStructurees(langue),
		script: '<script type="module" src="/deposer.js"></script>\n',
		corps: `<section class="une">
<h1>${e.accueil.h1}</h1>
<p class="chapeau">${e.accueil.chapeau}</p>
</section>
${formulaireDater(e, false)}
<p class="suite">${e.accueil.deja} ${lien(e, 'verifier')}.</p>
${etapes(e)}
${lignePour(e)}${compte}`
	});
}

/** Le journal public : les chiffres, la derniere racine, chaque tour, et la chaine. */
export function pageJournal(tours, langue = 'fr') {
	const e = EDITIONS[langue];
	const dernier = tours.at(-1);
	const lignes = [...tours]
		.reverse()
		.map(
			(t) =>
				`<tr><td>${e.dateHeure(t.instant)}</td><td class="n">${e.nombre(t.objets)}</td><td class="large"><code title="${t.racine}">${t.racine.slice(0, 16)}</code></td><td>${ancrageDe(t, langue)}</td><td class="large">${liensDe(e, t)}</td></tr>`
		)
		.join('\n');
	const [documents, nTours, depuis] = e.journal.chiffres;
	const tete = dernier
		? `<dl class="chiffres">
<div><dt>${documents}</dt><dd>${e.nombre(dernier.objets)}</dd></div>
<div><dt>${nTours}</dt><dd>${e.nombre(tours.length)}</dd></div>
<div><dt>${depuis}</dt><dd>${e.jour(tours[0].instant.slice(0, 10))}</dd></div>
</dl>
<section class="carte">
<h2>${e.journal.derniereRacine(e.dateHeure(dernier.instant))}</h2>
<p><code class="racine">${dernier.racine}</code></p>
<p>${ancrageDe(dernier, langue)}</p>
<p><button type="button" id="chaine">${e.journal.verifierChaine}</button></p>
<div id="resultat-chaine" aria-live="polite"></div>
</section>`
		: `<p>${e.journal.aucunTour}</p>`;
	const [tour, docs, racine, bitcoin, fichiers] = e.journal.colonnes;
	return gabarit(e, {
		titre: e.actes.journal.titre,
		description: e.journal.description,
		chemin: e.actes.journal.chemin,
		chemins: cheminsDe('journal'),
		script: '<script type="module" src="/verifier.js"></script>\n',
		corps: `<h1>${e.actes.journal.titre}</h1>
<p class="sous-titre">${e.journal.sousTitre}</p>
${tete}
<h2>${e.journal.tours(tours.length)}</h2>
<div class="defile">
<table>
<thead><tr><th>${tour}</th><th class="n">${docs}</th><th class="large">${racine}</th><th>${bitcoin}</th><th class="large">${fichiers}</th></tr></thead>
<tbody>
${lignes}
</tbody>
</table>
</div>
<p><a href="${DEPOT}/blob/main/scripts/verifier.mjs">${e.journal.script}</a></p>${langue === 'fr' ? `\n<p><a href="${CHEMIN_DISPARUS}">Documents disparus</a></p>` : ''}`
	});
}

/** Verifier : un document, ou son empreinte. */
export function pageVerifier(langue = 'fr') {
	const e = EDITIONS[langue];
	return gabarit(e, {
		titre: e.actes.verifier.titre,
		description: e.verifier.description,
		chemin: e.actes.verifier.chemin,
		chemins: cheminsDe('verifier'),
		script: '<script type="module" src="/verifier.js"></script>\n',
		corps: `<section class="une une-page"><h1>${e.actes.verifier.titre}</h1></section>
<form id="formulaire" class="carte">
${choixDeFichier(e.verifier.deposez, langue)}
<details>
<summary>${e.verifier.autrement}</summary>
<label for="empreinte">${e.empreinte.libelle}</label>
<input type="text" id="empreinte" autocomplete="off" spellcheck="false">
</details>
<button type="submit" class="principal large-bouton">${e.verifier.bouton}</button>
</form>
<div id="resultat" aria-live="polite"></div>`
	});
}

/** Dater : le fichier par defaut, les deux autres voies repliees. */
export function pageDeposer(langue = 'fr') {
	const e = EDITIONS[langue];
	return gabarit(e, {
		titre: e.actes.dater.titre,
		description: e.deposer.description,
		chemin: e.actes.dater.chemin,
		chemins: cheminsDe('dater'),
		script: '<script type="module" src="/deposer.js"></script>\n',
		corps: `<section class="une une-page"><h1>${e.actes.dater.titre}</h1></section>
${formulaireDater(e)}
<p class="compte">${e.deposer.compte(lien(e, 'preuve'))}</p>`
	});
}

/** La page d'un besoin cherche : son titre, une phrase, et le geste de dater sur la page. */
export function pageBesoin(besoin) {
	const e = EDITIONS.fr;
	return gabarit(e, {
		titre: besoin.titre,
		description: besoin.description,
		chemin: besoin.chemin,
		script: '<script type="module" src="/deposer.js"></script>\n',
		corps: `<section class="une une-page"><h1>${besoin.titre}</h1>
<p class="chapeau">${besoin.chapeau}</p></section>
${besoin.geste === 'lien' ? formulaireDuLien(e) : formulaireDater(e, false)}
<p class="compte">${e.deposer.compte(lien(e, 'preuve'))}</p>`
	});
}

/** Le formulaire d'un besoin qui se date par son adresse : le lien seul, le nom replie. */
const formulaireDuLien = (e) => `<form id="formulaire" class="carte">
<label for="url">Adresse de la page</label>
<input type="text" id="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://" required>
<details>
<summary>${e.formulaire.nommer}</summary>
<label for="libelle">${e.formulaire.nom}</label>
<input type="text" id="libelle" maxlength="200" autocomplete="off">
</details>
<button type="submit" class="principal large-bouton">Dater cette page</button>
<p class="recoit">Vous recevez un reçu à imprimer ou à télécharger. Il atteste que cette page était en ligne à cette adresse à cet instant.</p>
</form>
<div id="resultat" aria-live="polite"></div>`;

/** Les besoins, pour l'accueil : chacun lie a sa page. Francais seulement. */
const lignePour = (e) => (e.actes.acte ? `<p class="suite">Pour ${BESOINS.map((b) => `<a href="${b.chemin}">${b.nom}</a>`).join(', ')}.</p>\n` : '');

/** Dater un acte de collectivite : l'adresse ou il est publie, la collectivite, la nature. */
export function pageActe() {
	const e = EDITIONS.fr;
	return gabarit(e, {
		titre: ACTES.acte.titre,
		description: "Dater la mise en ligne d'un acte d'une collectivité, délibération, arrêté ou décision : le service lit l'acte à son adresse et délivre un reçu.",
		chemin: ACTES.acte.chemin,
		script: '<script type="module" src="/deposer.js"></script>\n',
		corps: `<section class="une une-page"><h1>${ACTES.acte.titre}</h1></section>
<form id="formulaire" class="carte">
<label for="url">Lien du fichier de l’acte (le PDF)</label>
<input type="text" id="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://" required>
<label for="collectivite">Code INSEE de la commune, ou SIREN de la collectivité</label>
<input type="text" id="collectivite" inputmode="numeric" autocomplete="off" spellcheck="false" maxlength="11" required>
<label for="nature">Nature</label>
<select id="nature">${optionsDeNature()}</select>
<label for="objet">Objet de l’acte</label>
<input type="text" id="objet" maxlength="200" autocomplete="off" required>
<p class="avertir">À faire le jour de la mise en ligne${NBSP}: le reçu porte le jour où vous cliquez.</p>
<button type="submit" class="principal large-bouton">Dater cet acte</button>
<p class="recoit">Vous recevez un reçu à imprimer ou à télécharger. Il atteste que ce fichier était en ligne à cette adresse à cet instant.</p>
${accepterConditions(e)}
</form>
<div id="resultat" aria-live="polite"></div>
<p class="compte">Gratuit, sans compte, jusqu’à 20 actes par jour.</p>`
	});
}

const jourFr = EDITIONS.fr.jour;
const nombre = EDITIONS.fr.nombre;

const majuscule = (t) => `${t[0].toUpperCase()}${t.slice(1)}`;
const marqueDuPluriel = (n) => (n > 1 ? 's' : '');

/** Le titre d'une serie : le compte et la nature. */
const titreDeSerie = (n) => (n ? `${nombre(n)} acte${marqueDuPluriel(n)} daté${marqueDuPluriel(n)}` : 'Aucun acte daté');

/** La ligne qui dit qu'une serie est coupee, vide sinon. */
const coupe = (serie) => (serie.total > serie.actes.length ? `<p class="compte">Les ${nombre(serie.actes.length)} plus récents sur ${nombre(serie.total)}.</p>` : '');

/** L'objet d'un acte, lie a l'acte en ligne quand son adresse est connue. */
const objetDe = (a, sansObjet = 'Sans objet') => {
	const objet = a.objet ? echapper(a.objet) : sansObjet;
	return a.url ? `<a href="${echapper(a.url)}">${objet}</a>` : objet;
};

const lienDuDepartement = (code) => `<a href="/collectivite/departement/${code}">${nomDuDepartement(code)}</a>`;

/** La serie d'une collectivite : ses actes lus sur son site officiel, chacun avec son reçu. */
export function pageCollectivite({ code, commune, serie, departement = null }) {
	const nom = commune ? echapper(commune.nom) : `Collectivité ${code}`;
	const codes = `${commune?.siren ? `Code INSEE ${code}, SIREN ${commune.siren}` : `Code ${code}`}${departement ? `, ${lienDuDepartement(departement)}` : ''}`;
	const lignes = serie.actes
		.map(
			(a) =>
				`<tr><td>${jourFr(a.jour)}</td><td>${majuscule(NATURES[a.nature] ?? a.nature)}</td><td>${objetDe(a)}</td><td><a href="${cheminDeLActe({ collectivite: code, ...a })}">Preuve</a></td></tr>`
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
	return gabarit(EDITIONS.fr, {
		titre: `${nom}, actes datés`,
		description: `Actes de ${nom} datés à leur adresse sur le site officiel de la commune${NBSP}: date de mise en ligne, nature, objet, reçu.`,
		chemin: `/collectivite/${code}`,
		indexer: serie.total > 0,
		corps: `<h1>${nom}</h1>
<p class="sous-titre">${codes}</p>
<h2>${titreDeSerie(serie.total)}</h2>
${tableau}
<p class="compte">${serie.depuis ? `Actes datés ici depuis le ${jourFr(serie.depuis)}, lus` : 'Actes lus'} sur le site officiel de la commune. ${lien(EDITIONS.fr, 'preuve')}</p>
<p class="appel">Cette page est celle de votre commune${NBSP}? Datez vos actes le jour de leur mise en ligne.</p>
<p><a class="bouton principal" href="${ACTES.acte.chemin}">${ACTES.acte.titre}</a></p>`
	});
}

const communeAbsente = `<p class="appel">Votre commune n’y figure pas${NBSP}? Datez la mise en ligne d’un de ses actes.</p>
<p><a class="bouton principal" href="${ACTES.acte.chemin}">${ACTES.acte.titre}</a></p>`;

const communesEtActes = (communes, actes) => `${nombre(communes)} commune${marqueDuPluriel(communes)}, ${nombre(actes)} acte${marqueDuPluriel(actes)} daté${marqueDuPluriel(actes)}`;

/** L'index des communes : chaque departement qui en porte au moins une, avec ses comptes. */
export function pageCommunes({ departements }) {
	const communes = departements.reduce((n, d) => n + d.communes, 0);
	const actes = departements.reduce((n, d) => n + d.actes, 0);
	const lignes = departements
		.map((d) => `<tr><td>${lienDuDepartement(d.code)}</td><td>${d.code}</td><td>${nombre(d.communes)}</td><td>${nombre(d.actes)}</td></tr>`)
		.join('\n');
	return gabarit(EDITIONS.fr, {
		titre: ACTES.communes.titre,
		description: `Les communes dont les actes sont datés à leur mise en ligne${NBSP}: ${communesEtActes(communes, actes)}, par département.`,
		chemin: ACTES.communes.chemin,
		indexer: communes > 0,
		corps: `<h1>${ACTES.communes.titre}</h1>
<h2>${communes ? communesEtActes(communes, actes) : 'Aucune commune'}</h2>
${
	communes
		? `<table>
<thead><tr><th>Département</th><th>Code</th><th>Communes</th><th>Actes</th></tr></thead>
<tbody>
${lignes}
</tbody>
</table>`
		: ''
}
${communeAbsente}`
	});
}

/** Les communes d'un departement qui ont un acte date, chacune avec son compte. */
export function pageDepartement({ code, nom, communes }) {
	const actes = communes.reduce((n, c) => n + c.actes, 0);
	const lignes = communes
		.map((c) => `<tr><td><a href="/collectivite/${c.insee}">${c.nom ? echapper(c.nom) : `Commune ${c.insee}`}</a></td><td>${c.insee}</td><td>${nombre(c.actes)}</td></tr>`)
		.join('\n');
	return gabarit(EDITIONS.fr, {
		titre: `${nom}, actes des communes`,
		description: `Actes des communes de ${nom} datés à leur mise en ligne${NBSP}: ${communesEtActes(communes.length, actes)}.`,
		chemin: `/collectivite/departement/${code}`,
		indexer: communes.length > 0,
		corps: `<h1>${nom}</h1>
<p class="sous-titre">Département ${code}</p>
<h2>${communes.length ? communesEtActes(communes.length, actes) : 'Aucune commune'}</h2>
${
	communes.length
		? `<table>
<thead><tr><th>Commune</th><th>Code INSEE</th><th>Actes</th></tr></thead>
<tbody>
${lignes}
</tbody>
</table>`
		: ''
}
${communeAbsente}`
	});
}

/** Les lignes propres a un acte rattache, dans son reçu. */
const lignesDActe = (e, acte, ligne) => {
	if (!acte) return '';
	const adresse = `${EDITIONS.fr.adresse}${cheminDeLActe({ ...acte, jour: ligne.jour, sha256: ligne.sha256 })}`;
	return `<div><dt>${e.recu.acte}</dt><dd>${e.recu.natures[acte.nature] ?? acte.nature}, ${objetDe(acte, e.recu.sansObjet)}</dd></div>
<div><dt>${e.recu.collectivite}</dt><dd><a href="${e.recu.adresseCollectivite(echapper(acte.collectivite))}">${echapper(acte.collectivite)}</a></dd></div>
<div><dt>${e.recu.adresseActe}</dt><dd><a href="${adresse}">${adresse}</a></dd></div>
`;
};

/** Le recu d'un depot, a son adresse : ce que la ligne publique engage, et son inscription au registre. */
export function pageRecu(ligne, acte = null, langue = 'fr') {
	const e = EDITIONS[langue];
	const jour = e.jour(ligne.jour);
	const chemin = `/recu/${ligne.recu}`;
	return gabarit(e, {
		titre: e.recu.titre(jour),
		description: e.recu.description(acte, jour, ligne.place),
		chemin,
		chemins: { fr: chemin, de: chemin },
		script: '<script type="module" src="/recu.js"></script>\n',
		corps: `<h1>${e.recu.h1}</h1>
<article class="ok recu" id="recu" data-recu="${ligne.recu}">
<h2>${acte ? e.recu.enLigne(jour) : e.recu.date(jour)}</h2>
<dl>
${lignesDActe(e, acte, ligne)}<div><dt>${e.recu.empreinte}</dt><dd><code class="racine">${ligne.sha256}</code></dd></div>
<div><dt>${e.recu.ligne}</dt><dd><a href="/depots/${ligne.jour}.jsonl">${e.recu.place(ligne.place, jour)}</a></dd></div>
<div><dt>${e.recu.registre}</dt><dd id="inscription">${e.recu.lecture}</dd></div>
</dl>
<p class="imprime">${e.hote}${chemin}</p>
</article>
<p class="gestes"><button type="button" id="imprimer" class="principal">${e.recu.imprimer}</button> ${lien(e, 'verifier', 'bouton')}</p>`
	});
}

/** Le nom d'une collectivite sur une page d'acte : celui de sa fiche, son code sinon. */
const nomDeCollectivite = (code, commune) => (commune ? echapper(commune.nom) : `Collectivité ${code}`);

/** Les donnees structurees d'un acte a son adresse : `Legislation`, identifie par l'adresse elle-meme. */
const structureDeLActe = (acte, adresse, commune) => ({
	'@context': 'https://schema.org',
	'@type': 'Legislation',
	legislationIdentifier: adresse,
	url: adresse,
	legislationType: majuscule(NATURES[acte.nature]),
	...(acte.objet ? { name: acte.objet } : {}),
	legislationJurisdiction: { '@type': 'AdministrativeArea', name: commune?.nom ?? acte.collectivite, identifier: commune?.insee ?? acte.collectivite }
});

/** Les versions vues a la meme source, la page courante marquee. */
function tableDesVersions(acte, versions) {
	if (versions.length === 0) return '';
	const lignes = versions
		.map((v) => {
			const chemin = cheminDeLActe(v);
			const courante = v.recu === acte.recu;
			return `<tr><td>${jourFr(v.jour)}</td><td><code>${v.sha256.slice(0, 12)}</code></td><td>${courante ? 'Cette page' : `<a href="${chemin}">${chemin}</a>`}</td></tr>`;
		})
		.join('\n');
	return `<h2>${nombre(versions.length)} version${marqueDuPluriel(versions.length)} à cette source</h2>
<table>
<thead><tr><th>Datée le</th><th>Empreinte</th><th>Adresse</th></tr></thead>
<tbody>
${lignes}
</tbody>
</table>`;
}

const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const OU_LUE = { libelle: 'dans le libellé', fichier: 'dans le nom du fichier' };

/** La date lue d'un acte, affichee comme lue : ou elle a ete lue, au jour ou au mois. */
function ligneDeLaDateLue(date) {
	if (!date) return '';
	const [an, mois] = date.date.split('-');
	const texte = date.precision === 'jour' ? jourFr(date.date) : `${MOIS_FR[Number(mois) - 1]} ${an}`;
	return `<div><dt>Date lue</dt><dd><time datetime="${date.date}">${texte}</time>, ${OU_LUE[date.dans]}</dd></div>\n`;
}

/** L'etat de la source : remplacee par une version plus recente, sinon ce que la glane y a vu a son dernier passage. */
function ligneDeLaSource(acte, versions, passage) {
	const derniere = versions.at(-1);
	if (derniere && derniere.recu !== acte.recu) return `<div><dt>À la source</dt><dd>Nouvelle version datée le <a href="${cheminDeLActe(derniere)}">${jourFr(derniere.jour)}</a></dd></div>\n`;
	if (!passage) return '';
	const vu = passage.etat === 'vue' ? 'Lien publié' : 'Lien non retrouvé';
	return `<div><dt>À la source</dt><dd>${vu} au passage du ${jourFr(passage.jour)}</dd></div>\n`;
}

/**
 * La page d'un acte a son adresse perenne (D-205) : la preuve, la date lue, la
 * source et son etat au dernier passage de la glane, les versions vues a la
 * meme source. `acte.objet` et `acte.url` arrivent deja gardes (null quand ils
 * pourraient nommer une personne).
 */
export function pageAdresse({ acte, commune = null, versions = [], passage = null, date = null }) {
	const e = EDITIONS.fr;
	const chemin = cheminDeLActe(acte);
	const adresse = `${e.adresse}${chemin}`;
	const nature = majuscule(NATURES[acte.nature]);
	const nom = nomDeCollectivite(acte.collectivite, commune);
	const jour = jourFr(acte.jour);
	const source = acte.url ? `<div><dt>Source</dt><dd><a href="${echapper(acte.url)}">${echapper(acte.url)}</a></dd></div>\n` : '';
	return gabarit(e, {
		titre: `${nature} en ligne le ${jour}, ${nom}`,
		description: `${nature} de ${nom}, en ligne le ${jour}${NBSP}: empreinte SHA-256, entrée du registre public, adresse de la source.`,
		chemin,
		structure: structureDeLActe(acte, adresse, commune),
		script: '<script type="module" src="/recu.js"></script>\n',
		corps: `<h1>${nature}, ${nom}</h1>
<p class="sous-titre">${acte.objet ? echapper(acte.objet) : e.recu.sansObjet}</p>
<article class="ok recu" id="recu" data-recu="${acte.recu}">
<h2>${e.recu.enLigne(jour)}</h2>
<dl>
<div><dt>${e.recu.empreinte}</dt><dd><code class="racine">${acte.sha256}</code></dd></div>
<div><dt>${e.recu.ligne}</dt><dd><a href="/depots/${acte.jour}.jsonl">${e.recu.place(acte.place, jour)}</a></dd></div>
<div><dt>${e.recu.registre}</dt><dd id="inscription">${e.recu.lecture}</dd></div>
<div><dt>Reçu</dt><dd><a href="/recu/${acte.recu}">${acte.recu.slice(0, 12)}</a></dd></div>
<div><dt>${e.recu.collectivite}</dt><dd><a href="/collectivite/${commune?.insee ?? acte.collectivite}">${nom}</a></dd></div>
${ligneDeLaDateLue(date)}${source}${ligneDeLaSource(acte, versions, passage)}</dl>
<p class="imprime">${e.hote}${chemin}</p>
</article>
${tableDesVersions(acte, versions)}`
	});
}

/** Un prefixe d'empreinte qui designe plusieurs actes : la liste de leurs adresses. */
export function pageAdresses(actes) {
	const lignes = actes.map((a) => `<li><a href="${cheminDeLActe(a)}">${cheminDeLActe(a)}</a></li>`).join('\n');
	return gabarit(EDITIONS.fr, {
		titre: `${nombre(actes.length)} actes à cette adresse`,
		description: `${nombre(actes.length)} actes datés le même jour dont l’empreinte commence de même.`,
		chemin: '/actes/',
		indexer: false,
		corps: `<h1>${nombre(actes.length)} actes à cette adresse</h1>
<ul>
${lignes}
</ul>`
	});
}

/** Le registre public d'un editeur : chaque version datee de ses articles, sans adresse ni titre. */
export function pageEditeur({ flux, total, versions }, langue = 'fr') {
	const e = EDITIONS[langue];
	const parArticle = new Map();
	for (const v of versions) parArticle.set(v.article, (parArticle.get(v.article) ?? 0) + 1);
	const lignes = versions
		.map(
			(v) =>
				`<tr><td><code>${v.article.slice(0, 12)}</code></td><td class="n">${parArticle.get(v.article)}</td><td><a href="/recu/${v.recu}">${e.jour(v.jour)}</a></td><td class="n">${v.place}</td><td class="large"><code title="${v.sha256}">${v.sha256.slice(0, 16)}</code></td></tr>`
		)
		.join('\n');
	const [article, nVersions, datee, ligne, empreinte] = e.editeur.colonnes;
	const tableau = versions.length
		? `<table>
<thead><tr><th>${article}</th><th class="n">${nVersions}</th><th>${datee}</th><th class="n">${ligne}</th><th class="large">${empreinte}</th></tr></thead>
<tbody>
${lignes}
</tbody>
</table>
${total > versions.length ? `<p class="compte">${e.editeur.coupe(versions.length, total)}</p>` : ''}`
		: '';
	const inscrit = e.jour(flux.inscrit.slice(0, 10));
	const etat = flux.retire ? e.editeur.suiviDuAu(inscrit, e.jour(flux.retire.slice(0, 10))) : e.editeur.suiviDepuis(inscrit);
	const chemin = `/editeur/${flux.id}`;
	return gabarit(e, {
		titre: e.editeur.titre(flux.id),
		description: e.editeur.description(flux.id),
		chemin,
		chemins: { fr: chemin, de: chemin },
		indexer: total > 0,
		script: '<script type="module" src="/editeur.js"></script>\n',
		corps: `<h1>${e.editeur.h1}</h1>
<p class="sous-titre">${e.editeur.flux(flux.id, etat)}</p>
<h2>${total ? e.editeur.compte(parArticle.size, total) : e.editeur.aucune}</h2>
${tableau}
<section id="prive" data-flux="${flux.id}" hidden></section>`
	});
}

/** Une adresse de recu qui ne nomme aucun depot. */
export function pageRecuInconnu(langue = 'fr') {
	const e = EDITIONS[langue];
	return gabarit(e, {
		titre: e.recuInconnu.titre,
		description: e.recuInconnu.description,
		chemin: '/recu/',
		corps: `<h1>${e.recuInconnu.titre}</h1>
<p>${lien(e, 'verifier', 'bouton')}</p>`
	});
}

/** Toute adresse sans page : un vrai 404, jamais l'accueil servi a la place d'un fichier absent. */
export function pageIntrouvable(langue = 'fr') {
	const e = EDITIONS[langue];
	return gabarit(e, {
		titre: e.introuvable.titre,
		description: e.introuvable.description,
		chemin: '/404',
		corps: `<h1>${e.introuvable.titre}</h1>
<p>${lien(e, 'dater', 'bouton principal')} ${lien(e, 'verifier', 'bouton')}</p>`
	});
}

const tableDoc = (titre, lignes) => `<h2>${titre}</h2>
<table class="doc">
<tbody>
${lignes.map(([gauche, droite]) => `<tr><td><code>${gauche}</code></td><td>${droite}</td></tr>`).join('\n')}
</tbody>
</table>`;

/** Les adresses qu'une edition explique, avec leur explication. */
const lignesDAdresses = (adresses, textes) => adresses.filter(([cle]) => textes[cle]).map(([cle, adresse]) => [adresse, textes[cle]]);

/** Chaque formule derriere son nom, suivie de ce que l'edition en dit. */
const lignesDeFormules = (textes) => Object.entries(FORMULES).map(([cle, formule]) => [textes[cle][0], `${formule}${textes[cle][1] ?? ''}`]);

/** La documentation : les adresses, les limites et les formules, pour verifier sans ce site. */
export function pageDocumentation(langue = 'fr') {
	const e = EDITIONS[langue];
	const [dater, agents, lire, verifier, textes, textesArchivage] = e.documentation.titres;
	return gabarit(e, {
		titre: e.actes.documentation.titre,
		description: e.documentation.description,
		chemin: e.actes.documentation.chemin,
		chemins: cheminsDe('documentation'),
		corps: `<h1>${e.actes.documentation.titre}</h1>
${tableDoc(dater, lignesDAdresses(ADRESSES.dater, e.documentation.dater))}
${tableDoc(agents, lignesDAdresses(ADRESSES.agents, e.documentation.agents))}
${tableDoc(lire, lignesDAdresses(ADRESSES.lire, e.documentation.lire))}
${tableDoc(verifier, lignesDeFormules(e.documentation.verifier))}
<h2>${textes}</h2>
${elements(TEXTES_DU_REGISTRE.map((acte) => lien(e, acte)))}
<h2>${textesArchivage}</h2>
${elements(TEXTES_DE_L_ARCHIVAGE.map((acte) => lien(e, acte)))}`
	});
}

/** Les textes de reference du registre, chacun sur sa page. */
export const TEXTES_DU_REGISTRE = ['pratiques', 'conditions', 'roles'];

/** Les textes de reference du service d'archivage (l'entrepot), chacun sur sa page. */
export const TEXTES_DE_L_ARCHIVAGE = ['archivage', 'conditionsArchivage'];

/** La version en vigueur des textes du registre ; une version nouvelle ne remplace jamais un texte en place. */
export const VERSION_DES_TEXTES = { numero: 1, jour: '2026-10-14' };

/** La version en vigueur des textes de l'archivage, publies apres ceux du registre. */
export const VERSION_DES_TEXTES_D_ARCHIVAGE = { numero: 1, jour: '2026-10-15' };

/** Le debut d'une page de texte : son titre et sa version. */
const enTeteDeTexte = (e, acte) => {
	const v = TEXTES_DE_L_ARCHIVAGE.includes(acte) ? VERSION_DES_TEXTES_D_ARCHIVAGE : VERSION_DES_TEXTES;
	return `<h1>${e.actes[acte].titre}</h1>
<p class="sous-titre">${e.version(v.numero, e.jour(v.jour))}</p>`;
};

const pageDeTexte = (e, acte, corps) =>
	gabarit(e, { titre: e.actes[acte].titre, description: e[acte].description, chemin: e.actes[acte].chemin, chemins: cheminsDe(acte), corps: `${enTeteDeTexte(e, acte)}\n${corps}` });

/** Une page de texte faite de sections : un titre, un paragraphe ; un paragraphe peut citer une autre page. */
export function pageSections(acte, langue = 'fr') {
	const e = EDITIONS[langue];
	const liens = { documentation: lien(e, 'documentation'), mentions: lien(e, 'mentions'), roles: lien(e, 'roles') };
	return pageDeTexte(e, acte, e[acte].sections.map(([titre, texte]) => `<h2>${titre}</h2>\n<p>${typeof texte === 'function' ? texte(liens) : texte}</p>`).join('\n'));
}

/** Les roles de confiance : chacun, ce qu'il fait, son garde-fou, qui les tient, et les formations. */
export function pageRoles(langue = 'fr') {
	const e = EDITIONS[langue];
	const [role, fait, garde] = e.roles.colonnes;
	const lignes = e.roles.liste.map(([nom, mission, gardeFou]) => `<tr><td><strong>${nom}</strong></td><td>${mission}</td><td>${gardeFou}</td></tr>`).join('\n');
	return pageDeTexte(
		e,
		'roles',
		`<table>
<thead><tr><th>${role}</th><th>${fait}</th><th>${garde}</th></tr></thead>
<tbody>
${lignes}
</tbody>
</table>
<p>${e.roles.titulaire(lien(e, 'mentions'), e.jour('2026-10-11'))}</p>
<h2>${e.roles.formations}</h2>`
	);
}

/** Les copies du registre hors de ce site. */
export const COPIES = [
	{ nom: 'Dépôt Git public', adresse: DEPOT },
	{ nom: 'Software Heritage', adresse: `https://archive.softwareheritage.org/browse/origin/?origin_url=${DEPOT}` },
	{ nom: 'Bitcoin, par OpenTimestamps', adresse: 'https://opentimestamps.org' }
];

/** Le premier jour d'un horodatage qualifie, null tant qu'aucun tour n'en porte. */
export function premierHorodatageQualifie(tours, langue = 'fr') {
	const tour = tours.find((t) => t.fichiers.some((f) => f.endsWith('.racine.tsr')));
	return tour ? EDITIONS[langue].jour(tour.instant.slice(0, 10)) : null;
}

const elements = (lignes) => `<ul>\n${lignes.map((l) => `<li>${l}</li>`).join('\n')}\n</ul>`;

/** Ce qu'un recu prouve, ce qu'il ne prouve pas, les textes, et ce qui reste si le site disparait. */
export function pagePreuve(tours, copies = COPIES, langue = 'fr') {
	const e = EDITIONS[langue];
	const qualifie = premierHorodatageQualifie(tours, langue);
	return gabarit(e, {
		titre: e.actes.preuve.titre,
		description: e.preuve.description,
		chemin: e.actes.preuve.chemin,
		chemins: cheminsDe('preuve'),
		corps: `<h1>${e.actes.preuve.titre}</h1>
<h2>${e.preuve.prouve}</h2>
${elements([e.preuve.existait, e.preuve.lien, qualifie ? e.preuve.ancrageQualifie(qualifie) : e.preuve.ancrage])}
<h2>${e.preuve.neProuvePas}</h2>
${elements(e.preuve.limites)}
<h2>${e.preuve.textes}</h2>
${elements(e.preuve.lois)}
<h2>${e.preuve.disparait}</h2>
<p>${e.preuve.suffisent(lien(e, 'documentation'))}</p>
${elements(copies.map((c, i) => `<a href="${c.adresse}">${e.preuve.copies[i] ?? c.nom}</a>`))}
<p><code>node scripts/verifier.mjs &lt;document&gt;</code> ${e.preuve.et} <code>ots verify &lt;tour&gt;.racine.ots</code></p>`
	});
}

/** Les mentions legales, ou l'Impressum : l'editeur, l'hebergeur, et ce que le service garde. */
export function pageMentions(langue = 'fr') {
	const e = EDITIONS[langue];
	return gabarit(e, {
		titre: e.actes.mentions.titre,
		description: e.mentions.description(e.marque),
		chemin: e.actes.mentions.chemin,
		corps: `<h1>${e.actes.mentions.titre}</h1>
${e.mentions.sections.map(([titre, texte]) => `<h2>${titre}</h2>\n<p>${texte}</p>`).join('\n')}
<h2>${e.mentions.code}</h2>
<p><a href="${DEPOT}">${DEPOT.replace('https://', '')}</a></p>`
	});
}

/* ------------------------------------------------------------ ce qui a disparu (D-193) */

/** Le nom d'un evenement : un document sorti de sa liste n'est jamais dit supprime. */
export const EVENEMENTS = { disparu: 'Disparu', remplace: 'Remplacé à la même adresse', retire: 'Sorti de la liste' };

export const CHEMIN_DISPARUS = '/disparus';
export const FLUX_DISPARUS = '/disparus.xml';
/** L'adresse de la page d'un site : son hote, les points en tirets (un `.com` final se lirait comme une extension). */
export const cheminDuSite = (site) => `${CHEMIN_DISPARUS}/${site.replaceAll('.', '-')}`;

/** Le dernier segment de l'adresse, decode, pour la lire dans une cellule. */
export function nomDuDocument(url) {
	const segment = new URL(url).pathname.split('/').filter(Boolean).at(-1) ?? url;
	try {
		return decodeURIComponent(segment);
	} catch {
		return segment;
	}
}

const lienDePreuve = (sha256) => `/verifier?empreinte=${sha256}`;

const ligneDisparu = (d, avecSite) =>
	`<tr><td>${jourFr(d.date)}</td><td>${EVENEMENTS[d.classe]}</td>${avecSite ? `<td><a href="${cheminDuSite(d.site)}">${echapper(d.site)}</a></td>` : ''}<td><a href="${echapper(d.url)}">${echapper(nomDuDocument(d.url))}</a></td><td class="n">${d.http ?? ''}</td><td><a href="${lienDePreuve(d.avant.sha256)}">${d.avant.jour ? `Version du ${jourFr(d.avant.jour)}` : 'Version d’avant'}</a></td></tr>`;

const tableDesDisparus = (entrees, avecSite) => `<div class="defile">
<table>
<thead><tr><th>Vu le</th><th>Événement</th>${avecSite ? '<th>Site</th>' : ''}<th>Document</th><th class="n">HTTP</th><th>Preuve</th></tr></thead>
<tbody>
${entrees.map((d) => ligneDisparu(d, avecSite)).join('\n')}
</tbody>
</table>
</div>`;

const titreDesDisparus = (n) => (n ? `${nombre(n)} document${marqueDuPluriel(n)}` : 'Aucun document');
const lienDuFlux = `<link rel="alternate" type="application/rss+xml" title="Documents disparus" href="${FLUX_DISPARUS}">\n`;
const PLAFOND_DISPARUS = 100;

/** Les documents disparus, remplaces ou sortis de leur liste : les sites, puis les plus recents. */
export function pageDisparus({ entrees, sites }) {
	const lignesSites = sites.map((s) => `<tr><td><a href="${cheminDuSite(s.site)}">${echapper(s.site)}</a></td><td class="n">${nombre(s.n)}</td></tr>`).join('\n');
	const recents = entrees.slice(0, PLAFOND_DISPARUS);
	return gabarit(EDITIONS.fr, {
		titre: 'Documents disparus',
		description: `Documents disparus, remplacés ou sortis de leur liste sur ${nombre(sites.length)} site${marqueDuPluriel(sites.length)} surveillé${marqueDuPluriel(sites.length)}${NBSP}: date, adresse, code HTTP, preuve de la version d’avant.`,
		chemin: CHEMIN_DISPARUS,
		indexer: entrees.length > 0,
		script: lienDuFlux,
		corps: `<h1>Documents disparus</h1>
<h2>${entrees.length ? `${titreDesDisparus(entrees.length)}, ${nombre(sites.length)} site${marqueDuPluriel(sites.length)}` : 'Aucun document disparu'}</h2>
${
	sites.length
		? `<table>
<thead><tr><th>Site</th><th class="n">Documents</th></tr></thead>
<tbody>
${lignesSites}
</tbody>
</table>
<h2>Les plus récents</h2>
${tableDesDisparus(recents, true)}
${entrees.length > recents.length ? `<p class="compte">Les ${nombre(recents.length)} plus récents sur ${nombre(entrees.length)}.</p>` : ''}`
		: ''
}
<p><a href="${FLUX_DISPARUS}">Flux RSS</a></p>`
	});
}

/** Les documents d'un site. */
export function pageDisparusDuSite({ site, entrees }) {
	return gabarit(EDITIONS.fr, {
		titre: `${site}, documents disparus`,
		description: `Documents de ${site} disparus, remplacés ou sortis de leur liste${NBSP}: date, adresse, code HTTP, preuve de la version d’avant.`,
		chemin: cheminDuSite(site),
		script: lienDuFlux,
		corps: `<h1>${echapper(site)}</h1>
<h2>${titreDesDisparus(entrees.length)}</h2>
${tableDesDisparus(entrees, false)}
<p><a href="${CHEMIN_DISPARUS}">Tous les sites</a> <a href="${FLUX_DISPARUS}">Flux RSS</a></p>`
	});
}

const xml = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
const dateRss = (jour) => new Date(`${jour}T00:00:00Z`).toUTCString();

/** Le flux RSS 2.0 des entrees, les plus recentes d'abord. */
export function fluxDisparus(entrees) {
	const e = EDITIONS.fr;
	const items = entrees
		.slice(0, PLAFOND_DISPARUS)
		.map(
			(d) => `<item>
<title>${xml(`${EVENEMENTS[d.classe]}, ${d.site}, ${nomDuDocument(d.url)}`)}</title>
<link>${xml(`${e.adresse}${lienDePreuve(d.avant.sha256)}`)}</link>
<guid isPermaLink="false">${xml(`${d.classe}:${d.avant.sha256}:${d.url}`)}</guid>
<pubDate>${dateRss(d.date)}</pubDate>
<description>${xml(`${d.url}${d.http ? `, HTTP ${d.http}` : ''}, version d’avant ${d.avant.sha256}`)}</description>
</item>`
		)
		.join('\n');
	return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>${xml(`Documents disparus, ${e.marque}`)}</title>
<link>${e.adresse}${CHEMIN_DISPARUS}</link>
<description>Documents disparus, remplacés ou sortis de leur liste sur les sites surveillés.</description>
<language>fr</language>
${items}
</channel>
</rss>
`;
}
