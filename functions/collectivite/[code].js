// GET /collectivite/<code> : les actes d'une collectivite lus sur son site officiel.
import { communeDesActifs } from '../../src/annuaire.mjs';
import { reponseCollectivite } from '../../src/collectivite.mjs';

export async function onRequestGet({ params, env, request }) {
	const r = await reponseCollectivite({ db: env.DEPOTS, code: params.code, commune: communeDesActifs(env, request.url) });
	return new Response(r.corps || null, { status: r.statut, headers: r.entetes });
}
