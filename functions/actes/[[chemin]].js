// GET /actes/<code>/<jour>/<nature>-<hex> : l'adresse perenne d'un acte date (D-205).
import { communeDesActifs } from '../../src/annuaire.mjs';
import { reponseAdresse } from '../../src/collectivite.mjs';

export async function onRequestGet({ params, env, request }) {
	const segments = [params.chemin ?? []].flat();
	const r = await reponseAdresse({ db: env.DEPOTS, segments, commune: communeDesActifs(env, request.url) });
	return new Response(r.corps || null, { status: r.statut, headers: r.entetes });
}
