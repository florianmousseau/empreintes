// Le repartiteur de `fetch` (undici, embarque dans Node) garde un Pool par
// origine jusqu'a la fin du processus, et chaque Pool reserve une file de 2 048
// cases (16 Ko) : sur le VPS le 2026-10-17, 12 366 origines lues par la glane
// tenaient 203 Mo des 313 Mo de son tas. Le renouveler de temps en temps rend
// cette place ; les lectures en cours finissent sur l'ancien.

/** La cle sous laquelle undici range le repartiteur global de `fetch`. */
export const CLE_REPARTITEUR = Symbol.for('undici.globalDispatcher.1');

/**
 * Remplace le repartiteur global par un neuf du meme type et ferme l'ancien une
 * fois ses lectures finies ; rend false s'il n'y en a pas encore.
 */
export function renouvelerLesConnexions(porteur = globalThis) {
	const ancien = porteur[CLE_REPARTITEUR];
	if (!ancien) return false;
	porteur[CLE_REPARTITEUR] = new ancien.constructor();
	ancien.close().catch(() => {});
	return true;
}
