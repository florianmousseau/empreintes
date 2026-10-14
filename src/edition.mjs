// Les deux editions de la meme surface : le francais sur temoinpublic.fr,
// l'allemand sur datumszeuge.de. Meme moteur, meme API, meme registre ; seul
// l'hote de la requete choisit la langue. `de.empreintes.pages.dev` est la voie
// de controle de l'edition allemande avant son domaine.

import { TEXTES, vue } from './textes.mjs';

/** L'heure d'un instant ISO, « 10:13 UTC », derriere le jour ecrit comme l'edition l'ecrit. */
const avecDateHeure = (t) => ({
	...t,
	dateHeure: (iso) => {
		const [j, h] = iso.split('T');
		return `${t.jour(j)} ${h.slice(0, 5)}\u00A0UTC`;
	}
});

export const EDITIONS = Object.fromEntries(['fr', 'de'].map((langue) => [langue, avecDateHeure(vue(TEXTES, langue))]));

export const HOTES_ALLEMANDS = ['datumszeuge.de', 'www.datumszeuge.de', 'de.empreintes.pages.dev'];

/** La langue servie a un hote : `de` pour l'edition allemande, `fr` pour tout le reste. */
export const langueDe = (hote) => (HOTES_ALLEMANDS.includes(String(hote ?? '').toLowerCase()) ? 'de' : 'fr');

/** La langue d'une requete, lue sur son hote. */
export const langueDeLaRequete = (request) => langueDe(new URL(request.url).hostname);

/** Les pages statiques d'une edition que les moteurs lisent, dans l'ordre du plan du site. */
export const planDe = (langue) => {
	const a = EDITIONS[langue].actes;
	return ['/', a.dater.chemin, a.verifier.chemin, ...(a.acte ? [a.acte.chemin] : []), a.journal.chemin, a.preuve.chemin, a.documentation.chemin, a.pratiques.chemin, a.conditions.chemin, a.roles.chemin, a.mentions.chemin];
};

/** Le chemin d'une meme page dans chaque edition, par la cle de l'acte ; `/` pour l'accueil. */
export const cheminsDe = (acte) => Object.fromEntries(Object.entries(EDITIONS).map(([l, e]) => [l, acte === 'accueil' ? '/' : e.actes[acte].chemin]));

/** Le dossier de `dist/` qui porte les pages d'une edition : la racine pour le francais, `de/` pour l'allemand. */
export const dossierDe = (langue) => (langue === 'fr' ? '' : `${langue}/`);
