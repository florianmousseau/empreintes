// Ce qui ne se publie jamais d'une adresse (D-193), partage par le filtre des
// sources de l'entrepot (`disparus.mjs`) et par celui des actes des communes
// (`disparusactes.mjs`, lu par une Function : rien de `node:` ici). Pur.

import { nommeUnePersonne } from './personne.mjs';
import { pourraitNommer } from './glane.mjs';

/** Les sha256 des adresses retenues sur un droit (`docs/legal/demandes.md` du cockpit). */
export const RETENUES = new Set([]);

/** Le texte qu'une adresse donne a lire : son chemin decode, les separateurs en espaces. */
export function texteDeLAdresse(url) {
	let chemin = new URL(url).pathname;
	try {
		chemin = decodeURIComponent(chemin);
	} catch {
		// Un %xx mal forme se lit tel quel : le controle porte alors sur les octets bruts.
	}
	return chemin.replace(/[-_+/]+/g, ' ').trim();
}

/** Vrai quand l'adresse pourrait nommer une personne. */
export function adresseNommante(url) {
	const texte = texteDeLAdresse(url);
	return nommeUnePersonne(texte) || pourraitNommer(texte);
}
