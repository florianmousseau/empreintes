// GET /recu/<id> : la page d'un recu, depuis sa ligne publique.
import { ligneDuRecu } from '../../src/service.mjs';
import { pageRecu, pageRecuInconnu } from '../../src/pages.mjs';

export async function onRequestGet({ params, env }) {
	const ligne = await ligneDuRecu({ db: env.DEPOTS, id: params.id });
	return new Response(ligne ? pageRecu(ligne) : pageRecuInconnu(), {
		status: ligne ? 200 : 404,
		headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=60' }
	});
}
