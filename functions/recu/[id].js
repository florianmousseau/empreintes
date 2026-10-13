// GET /recu/<id> : la page d'un recu, depuis sa ligne publique, dans la langue de l'hote.
import { acteDuRecu, ligneDuRecu } from '../../src/service.mjs';
import { langueDeLaRequete } from '../../src/edition.mjs';
import { pageRecu, pageRecuInconnu } from '../../src/pages.mjs';

export async function onRequestGet({ request, params, env }) {
	const langue = langueDeLaRequete(request);
	const ligne = await ligneDuRecu({ db: env.DEPOTS, id: params.id });
	const acte = ligne ? await acteDuRecu({ db: env.DEPOTS, id: params.id }) : null;
	return new Response(ligne ? pageRecu(ligne, acte, langue) : pageRecuInconnu(langue), {
		status: ligne ? 200 : 404,
		headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=60' }
	});
}
