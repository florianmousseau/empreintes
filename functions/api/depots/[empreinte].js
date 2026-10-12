// GET /api/depots/<sha256> : les lignes publiques des depots de cette empreinte.
import { lecturePublique, lignesDeLEmpreinte } from '../../../src/service.mjs';

export async function onRequestGet({ params, env }) {
	const r = lecturePublique(await lignesDeLEmpreinte({ db: env.DEPOTS, empreinte: params.empreinte }));
	return new Response(r.corps, { status: r.statut, headers: r.entetes });
}
