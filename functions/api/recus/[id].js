// GET /api/recus/<id> : la ligne publique d'un recu, et l'adresse de l'acte qu'il date.
import { lecturePublique, ligneEtAdresseDuRecu } from '../../../src/service.mjs';

export async function onRequestGet({ params, env }) {
	const r = lecturePublique(await ligneEtAdresseDuRecu({ db: env.DEPOTS, id: params.id }));
	return new Response(r.corps, { status: r.statut, headers: r.entetes });
}
