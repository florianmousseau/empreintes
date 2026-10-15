// POST /api/passages : la glane des actes des communes note la source de chaque acte a son passage (D-205).
// `authorization: Bearer <jeton>`, jeton `JETON_FLOTTE` ; personne d'autre n'ecrit ici.
import { estLaFlotte } from '../../src/depot.mjs';
import { noterPassage } from '../../src/service.mjs';

const JSON_UTF8 = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

export async function onRequestPost({ request, env }) {
	if (!(await estLaFlotte(request.headers.get('authorization'), env.JETON_FLOTTE))) return new Response(`${JSON.stringify({ erreur: 'jeton requis', details: [] })}\n`, { status: 401, headers: JSON_UTF8 });
	const corps = await request.json().catch(() => null);
	const r = await noterPassage({ db: env.DEPOTS, corps });
	return new Response(r.corps, { status: r.statut, headers: r.entetes });
}
