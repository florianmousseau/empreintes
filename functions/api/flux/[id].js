// DELETE /api/flux/<id> : retirer un flux, `authorization: Bearer <jeton>` ; les versions deja deposees restent.
import { retirerFlux } from '../../../src/suivi.mjs';

export async function onRequestDelete({ request, params, env }) {
	const jeton = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
	const r = await retirerFlux({ db: env.DEPOTS, id: params.id, jeton });
	return new Response(r.corps, { status: r.statut, headers: r.entetes });
}
