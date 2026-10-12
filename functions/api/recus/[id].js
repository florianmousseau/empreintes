// GET /api/recus/<id> : la ligne publique d'un recu.
import { lecturePublique, ligneDuRecu } from '../../../src/service.mjs';

export async function onRequestGet({ params, env }) {
	const r = lecturePublique(await ligneDuRecu({ db: env.DEPOTS, id: params.id }));
	return new Response(r.corps, { status: r.statut, headers: r.entetes });
}
