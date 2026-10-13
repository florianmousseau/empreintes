// Les deux editions de la meme surface : le francais sur temoinpublic.fr,
// l'allemand sur datumszeuge.de. Meme moteur, meme API, meme registre ; seul
// l'hote de la requete choisit la langue. `de.empreintes.pages.dev` est la voie
// de controle de l'edition allemande avant son domaine.

import fr from './textes/fr.mjs';
import de from './textes/de.mjs';

export const EDITIONS = { fr, de };

export const HOTES_ALLEMANDS = ['datumszeuge.de', 'www.datumszeuge.de', 'de.empreintes.pages.dev'];

/** La langue servie a un hote : `de` pour l'edition allemande, `fr` pour tout le reste. */
export const langueDe = (hote) => (HOTES_ALLEMANDS.includes(String(hote ?? '').toLowerCase()) ? 'de' : 'fr');

/** La langue d'une requete, lue sur son hote. */
export const langueDeLaRequete = (request) => langueDe(new URL(request.url).hostname);

/** Les pages statiques d'une edition que les moteurs lisent, dans l'ordre du plan du site. */
export const planDe = (langue) => {
	const a = EDITIONS[langue].actes;
	return ['/', a.dater.chemin, a.verifier.chemin, ...(a.acte ? [a.acte.chemin] : []), a.journal.chemin, a.documentation.chemin, a.mentions.chemin];
};

/** Le chemin d'une meme page dans chaque edition, par la cle de l'acte ; `/` pour l'accueil. */
export const cheminsDe = (acte) => Object.fromEntries(Object.entries(EDITIONS).map(([l, e]) => [l, acte === 'accueil' ? '/' : e.actes[acte].chemin]));

/** Le dossier de `dist/` qui porte les pages d'une edition : la racine pour le francais, `de/` pour l'allemand. */
export const dossierDe = (langue) => (langue === 'fr' ? '' : `${langue}/`);
