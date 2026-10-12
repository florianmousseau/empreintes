// POST /api/flux : suivre un flux RSS ou Atom (D-170) ; rend l'identifiant du flux et son jeton.
import { inscrireFlux } from '../../src/suivi.mjs';

export async function onRequestPost({ request, env }) {
	let corps;
	try {
		corps = await request.json();
	} catch {
		corps = null;
	}
	const r = await inscrireFlux({ db: env.DEPOTS, corps });
	return new Response(r.corps, { status: r.statut, headers: r.entetes });
}

export const onRequestOptions = () =>
	new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, DELETE', 'access-control-allow-headers': 'content-type, authorization', 'access-control-max-age': '86400' } });
