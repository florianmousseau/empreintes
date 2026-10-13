// Les pages de la surface. Elles affichent ; la methode vit dans le code. Chaque
// page se rend dans la langue d'une edition (`src/edition.mjs`), le francais par
// defaut ; les actes de collectivite ne se rendent qu'en francais.

import { NATURES } from './acte.mjs';
import { EDITIONS, cheminsDe, planDe } from './edition.mjs';
import { ADRESSES, FORMULES } from './documentation.mjs';

const NBSP = '\u00A0';
const DEPOT = 'https://github.com/florianmousseau/empreintes';
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

/** Les consignes aux robots d'une edition : tout, sauf l'index des empreintes, et son plan. */
export const robots = (langue = 'fr') => `User-agent: *
Allow: /
Disallow: /index/

Sitemap: ${EDITIONS[langue].adresse}/sitemap.xml
`;

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

/** Les trois gestes du menu, le courant marque pour les lecteurs d'ecran ; dater un acte reste dater. */
const navigation = (e, chemin) => {
	const courant = chemin === e.actes.acte?.chemin ? e.actes.dater.chemin : chemin;
	return ['dater', 'verifier', 'journal']
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
<p class="pied-liens">${lien(e, 'dater')} ${lien(e, 'verifier')} ${lien(e, 'journal')} ${lien(e, 'documentation')} ${lien(e, 'mentions')} <a href="${DEPOT}">${e.codeSource}</a></p>
</div></footer>
</body>
</html>
`;
}

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
${compte}`
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
<p><a href="${DEPOT}/blob/main/scripts/verifier.mjs">${e.journal.script}</a></p>`
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
<p class="compte">${e.deposer.compte}</p>`
	});
}

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
	return gabarit(EDITIONS.fr, {
		titre: `${nom}, actes datés`,
		description: `Actes de ${nom} datés à leur adresse sur le site officiel de la commune${NBSP}: date de mise en ligne, nature, objet, reçu.`,
		chemin: `/collectivite/${code}`,
		indexer: serie.total > 0,
		corps: `<h1>${nom}</h1>
<p class="sous-titre">${codes}</p>
<h2>${titreDeSerie(serie.total)}</h2>
${tableau}
<p class="compte">${serie.depuis ? `Actes datés ici depuis le ${jourFr(serie.depuis)}, lus` : 'Actes lus'} sur le site officiel de la commune.</p>
<p><a class="bouton principal" href="${ACTES.acte.chemin}">${ACTES.acte.titre}</a></p>`
	});
}

/** Les lignes propres a un acte rattache, dans son reçu. */
const lignesDActe = (e, acte) =>
	acte
		? `<div><dt>${e.recu.acte}</dt><dd>${e.recu.natures[acte.nature] ?? acte.nature}, ${objetDe(acte, e.recu.sansObjet)}</dd></div>
<div><dt>${e.recu.collectivite}</dt><dd><a href="${e.recu.adresseCollectivite(echapper(acte.collectivite))}">${echapper(acte.collectivite)}</a></dd></div>
`
		: '';

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
${lignesDActe(e, acte)}<div><dt>${e.recu.empreinte}</dt><dd><code class="racine">${ligne.sha256}</code></dd></div>
<div><dt>${e.recu.ligne}</dt><dd>${e.recu.place(ligne.place, jour)}</dd></div>
<div><dt>${e.recu.registre}</dt><dd id="inscription">${e.recu.lecture}</dd></div>
</dl>
<p class="imprime">${e.hote}${chemin}</p>
</article>
<p class="gestes"><button type="button" id="imprimer" class="principal">${e.recu.imprimer}</button> ${lien(e, 'verifier', 'bouton')}</p>`
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
	const [dater, lire, verifier] = e.documentation.titres;
	return gabarit(e, {
		titre: e.actes.documentation.titre,
		description: e.documentation.description,
		chemin: e.actes.documentation.chemin,
		chemins: cheminsDe('documentation'),
		corps: `<h1>${e.actes.documentation.titre}</h1>
${tableDoc(dater, lignesDAdresses(ADRESSES.dater, e.documentation.dater))}
${tableDoc(lire, lignesDAdresses(ADRESSES.lire, e.documentation.lire))}
${tableDoc(verifier, lignesDeFormules(e.documentation.verifier))}`
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
