// Les pages de la surface. Elles affichent ; la methode vit dans le code.

const NBSP = '\u00A0';
const ADRESSE = 'https://empreintes.florianmousseau.com';
const DEPOT = 'https://github.com/florianmousseau/empreintes';

/** Les trois actes du site, chacun sous un seul nom partout. */
export const ACTES = {
	dater: { chemin: '/deposer', nom: 'Dater un document' },
	verifier: { chemin: '/verifier', nom: 'Vérifier un document' },
	journal: { chemin: '/journal', nom: 'Registre des dates' },
	documentation: { chemin: '/documentation', nom: 'Documentation' }
};

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

function gabarit({ titre, description, chemin, corps, script = '' }) {
	return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titre}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${ADRESSE}${chemin}">
<link rel="stylesheet" href="/style.css">
<link rel="icon" href="/icone.svg" type="image/svg+xml">
${script}</head>
<body>
<header><a class="marque" href="/">Empreintes</a><nav>${lien('dater')} ${lien('verifier')} ${lien('journal')}</nav></header>
<main>
${corps}
</main>
<footer>${lien('documentation')}. Éditeur${NBSP}: <a href="https://florianmousseau.com">Florian Mousseau</a>. Code et journal${NBSP}: <a href="${DEPOT}">${DEPOT.replace('https://', '')}</a></footer>
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

const autresVoies = (champs) => `<details>
<summary>Pas le fichier sous la main${NBSP}?</summary>
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
${autresVoies(`<label for="url">Son adresse en ligne</label>
<input type="text" id="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://">
<label for="empreinte">Ou son empreinte SHA-256</label>
<input type="text" id="empreinte" autocomplete="off" spellcheck="false">`)}
<label for="libelle">Un nom pour vous en souvenir (facultatif)</label>
<input type="text" id="libelle" maxlength="200" autocomplete="off">
<p class="recoit">Vous recevez un reçu à imprimer ou à télécharger, à garder avec le document. Seule son empreinte est publiée, jamais le document.</p>
<button type="submit" class="principal">Dater ce document</button>
</form>
<div id="resultat" aria-live="polite"></div>
<p class="compte">Gratuit, sans compte, jusqu’à 20 documents par jour. Valeur juridique${NBSP}: un élément de preuve, que le juge apprécie librement.</p>`
	});
}

const jourFr = (j) => j.split('-').reverse().join('/');

/** Le recu d'un depot, a son adresse : ce que la ligne publique engage, et son inscription au registre. */
export function pageRecu(ligne) {
	return gabarit({
		titre: `Reçu de date du ${jourFr(ligne.jour)}`,
		description: `Reçu de date : document daté du ${jourFr(ligne.jour)}, ligne ${ligne.place}.`,
		chemin: `/recu/${ligne.recu}`,
		script: '<script type="module" src="/recu.js"></script>\n',
		corps: `<h1>Reçu de date</h1>
<article class="ok" id="recu" data-recu="${ligne.recu}">
<h2>Document daté du ${jourFr(ligne.jour)}</h2>
<dl>
<div><dt>Empreinte</dt><dd><code class="racine">${ligne.sha256}</code></dd></div>
<div><dt>Ligne</dt><dd>${ligne.place} du ${jourFr(ligne.jour)}</dd></div>
<div><dt>Registre</dt><dd id="inscription">lecture du registre</dd></div>
</dl>
</article>
<p>${lien('verifier', 'bouton')}</p>`
	});
}

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
	ligneDoc('201', 'le reçu, son identifiant, la ligne publique'),
	ligneDoc('429', `20 dépôts par jour et par adresse, 2${NBSP}000 par jour, <code>retry-after</code> jusqu’à minuit UTC`),
	ligneDoc('409', 'une même adresse en ligne lue une fois par jour'),
	ligneDoc('422', 'lecture impossible\u00A0: 20 Mo, 30 s, 5 redirections au plus, adresses publiques seulement')
])}
${tableDoc('Lire', [
	ligneDoc('GET /depots/&lt;jour&gt;.jsonl', 'les dépôts du jour, une ligne <code>{"sha256","jour","place","recu"}</code> par dépôt'),
	ligneDoc('GET /recu/&lt;id&gt;', 'la page d’un reçu'),
	ligneDoc('GET /api/recus/&lt;id&gt;', 'la ligne publique d’un reçu'),
	ligneDoc('GET /api/depots/&lt;sha256&gt;', 'les dépôts d’une empreinte'),
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
