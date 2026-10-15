// POST /api/depots : deposer une empreinte, ou faire lire une URL par le temoin.
import { annuaireDesActifs } from '../../src/annuaire.mjs';
import { deposer } from '../../src/service.mjs';

/** Le registre des autorites publie avec le site ; null s'il n'a pas ete construit. */
const autoritesDesActifs = (env, base) => async () => {
	const r = await env.ASSETS.fetch(new URL('/confiance/autorites.json', base));
	return r.ok ? r.json() : null;
};

export async function onRequestPost({ request, env }) {
	let corps;
	try {
		corps = await request.json();
	} catch {
		corps = null;
	}
	const r = await deposer({ db: env.DEPOTS, corps, adresse: request.headers.get('cf-connecting-ip'), annuaire: annuaireDesActifs(env, request.url), autorites: autoritesDesActifs(env, request.url) });
	return new Response(r.corps, { status: r.statut, headers: r.entetes });
}

export const onRequestOptions = () =>
	new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' } });
