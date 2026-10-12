// Les deux pages de la surface. Elles affichent ; la methode vit dans le code.

const NBSP = ' ';
const ADRESSE = 'https://empreintes.florianmousseau.com';
const MIROIR = 'https://github.com/florianmousseau/empreintes';

/** Echappe un texte pour le HTML. */
export const echapper = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const nombre = (n) => n.toLocaleString('fr-FR').replace(/ /g, NBSP);

/** Un instant ISO en « 12/10/2026 10:13 UTC ». */
export function dateHeure(iso) {
	const [j, h] = iso.split('T');
	return `${j.split('-').reverse().join('/')} ${h.slice(0, 5)}${NBSP}UTC`;
}

/** L'ancrage d'un tour, en clair, avec le lien du bloc quand il existe. */
export function ancrageDe(t) {
	if (t.ots === 'bitcoin' && t.bloc) return `<a href="https://mempool.space/block/${t.bloc}">Bitcoin, bloc ${t.bloc}</a>`;
	if (t.ots === 'calendrier') return 'en attente du bloc';
	return t.ots ? echapper(t.ots) : 'aucun';
}

const LIBELLE = { json: 'releve', racine: 'racine', 'racine.ots': '.ots', 'racine.tsr': '.tsr' };
const liensDe = (t) =>
	t.fichiers.map((f) => `<a href="/empreintes/${echapper(f)}">${LIBELLE[f.slice(t.id.length + 1)] ?? echapper(f)}</a>`).join(' ');

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
<header><a class="marque" href="/">Journal des empreintes</a><nav><a href="/deposer">Déposer</a> <a href="/verifier">Vérifier</a></nav></header>
<main>
${corps}
</main>
<footer>Éditeur${NBSP}: <a href="https://florianmousseau.com">Florian Mousseau</a>. Miroir${NBSP}: <a href="${MIROIR}">${MIROIR.replace('https://', '')}</a></footer>
</body>
</html>
`;
}

/** L'accueil : le dernier tour, puis tous les tours. */
export function pageAccueil(tours) {
	const dernier = tours.at(-1);
	const lignes = [...tours]
		.reverse()
		.map(
			(t) =>
				`<tr><td>${dateHeure(t.instant)}</td><td class="n">${nombre(t.objets)}</td><td><code title="${t.racine}">${t.racine.slice(0, 16)}</code></td><td>${ancrageDe(t)}</td><td>${liensDe(t)}</td></tr>`
		)
		.join('\n');
	const tete = dernier
		? `<dl class="chiffres">
<div><dt>Objets</dt><dd>${nombre(dernier.objets)}</dd></div>
<div><dt>Tours</dt><dd>${nombre(tours.length)}</dd></div>
<div><dt>Depuis le</dt><dd>${dateHeure(tours[0].instant).split(' ')[0]}</dd></div>
</dl>
<h2>Dernière racine, ${dateHeure(dernier.instant)}</h2>
<p><code class="racine">${dernier.racine}</code></p>
<p>${ancrageDe(dernier)}</p>`
		: '<p>Aucun tour publié.</p>';
	return gabarit({
		titre: 'Journal des empreintes',
		description: "Empreintes SHA-256 des fichiers publics archivés chaque jour, chaînées et ancrées dans Bitcoin par OpenTimestamps.",
		chemin: '/',
		corps: `<h1>Journal des empreintes</h1>
${tete}
<p><a class="bouton principal" href="/deposer">Dater un document</a> <a class="bouton" href="/verifier">Vérifier un fichier</a></p>
<h2>${nombre(tours.length)} tours</h2>
<div class="defile"><table>
<thead><tr><th>Tour</th><th class="n">Objets</th><th>Racine</th><th>Ancrage</th><th>Fichiers</th></tr></thead>
<tbody>
${lignes}
</tbody>
</table></div>`
	});
}

/** Le verificateur : un fichier ou une empreinte, puis la chaine. */
export function pageVerifier() {
	return gabarit({
		titre: 'Vérifier un fichier',
		description: "Dire si un fichier était servi tel quel un jour donné, et vérifier la chaîne des racines du journal.",
		chemin: '/verifier',
		script: '<script type="module" src="/verifier.js"></script>\n',
		corps: `<h1>Vérifier un fichier</h1>
<form id="formulaire">
<label for="fichier">Fichier</label>
<input type="file" id="fichier">
<label for="empreinte">Ou son empreinte SHA-256</label>
<input type="text" id="empreinte" inputmode="text" autocomplete="off" spellcheck="false" pattern="[0-9a-fA-F]{64}">
<button type="submit">Vérifier</button>
</form>
<div id="resultat" aria-live="polite"></div>
<h2>Chaîne des racines</h2>
<p><button type="button" id="chaine">Vérifier la chaîne</button></p>
<div id="resultat-chaine" aria-live="polite"></div>
<p><a href="${MIROIR}/blob/main/scripts/verifier.mjs">Script de vérification</a></p>`
	});
}

/** Le depot : une empreinte, un fichier haché sur place, ou une adresse que le service lit lui-meme. */
export function pageDeposer() {
	return gabarit({
		titre: 'Dater un document',
		description: "Déposer gratuitement l'empreinte SHA-256 d'un document dans le journal public, ancré dans Bitcoin, et recevoir son reçu.",
		chemin: '/deposer',
		script: '<script type="module" src="/deposer.js"></script>\n',
		corps: `<h1>Dater un document</h1>
<p class="chapeau">Son empreinte SHA-256 entre dans le journal public, ancré dans Bitcoin. Le document ne quitte pas votre appareil.</p>
<form id="formulaire">
<label for="fichier">Fichier</label>
<input type="file" id="fichier">
<label for="empreinte">Ou son empreinte SHA-256</label>
<input type="text" id="empreinte" autocomplete="off" spellcheck="false">
<label for="url">Ou l’adresse publique du document, lue par le service</label>
<input type="text" id="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://">
<label for="libelle">Libellé (facultatif, gardé dans votre reçu)</label>
<input type="text" id="libelle" maxlength="200" autocomplete="off">
<button type="submit" class="principal">Déposer</button>
</form>
<div id="resultat" aria-live="polite"></div>
<p>Gratuit, sans compte${NBSP}: 20 dépôts par jour et par adresse.</p>`
	});
}
