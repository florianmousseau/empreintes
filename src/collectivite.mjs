// La page publique d'une collectivite (D-165) : `/collectivite/<code>`, ses actes
// lus sur son site officiel. Une page par commune, a son code INSEE : le SIREN
// et l'ecriture en minuscules y renvoient.

import { estUnInsee, estUnSiren } from './acte.mjs';
import { pageCollectivite, pageIntrouvable } from './pages.mjs';
import { serieDeLaCollectivite } from './service.mjs';

const HTML = { 'content-type': 'text/html; charset=utf-8' };

/**
 * La reponse a `/collectivite/<code>` : `{ statut, corps, entetes }`.
 * `commune(code)` rend `{ nom, insee, siren }` ou null.
 */
export async function reponseCollectivite({ db, code, commune }) {
	const lu = String(code ?? '').toUpperCase();
	if (!estUnInsee(lu) && !estUnSiren(lu)) return { statut: 404, corps: pageIntrouvable(), entetes: { ...HTML, 'cache-control': 'public, max-age=300' } };
	const fiche = await commune(lu);
	const canonique = fiche?.insee ?? lu;
	if (canonique !== code) return { statut: 301, corps: '', entetes: { location: `/collectivite/${canonique}`, 'cache-control': 'public, max-age=3600' } };
	const codes = [canonique, fiche?.siren].filter(Boolean);
	const serie = await serieDeLaCollectivite({ db, codes });
	return { statut: 200, corps: pageCollectivite({ code: canonique, commune: fiche, serie }), entetes: { ...HTML, 'cache-control': 'public, max-age=60' } };
}
