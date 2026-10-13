// GET /editeur/<id> : le registre public d'un flux suivi (D-170), dans la langue de l'hote.
import { langueDeLaRequete } from '../../src/edition.mjs';
import { pageEditeur, pageIntrouvable } from '../../src/pages.mjs';
import { registreDeLEditeur } from '../../src/suivi.mjs';

export async function onRequestGet({ request, params, env }) {
	const langue = langueDeLaRequete(request);
	const registre = await registreDeLEditeur({ db: env.DEPOTS, id: params.id });
	return new Response(registre ? pageEditeur(registre, langue) : pageIntrouvable(langue), {
		status: registre ? 200 : 404,
		headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=60' }
	});
}
