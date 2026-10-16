// GET /sitemap-actes.xml[?page=<n>] : l'adresse perenne de chaque acte date (D-205), en pages de 50 000.
import { reponsePlanDesActes } from '../src/collectivite.mjs';

export async function onRequestGet({ env, request }) {
	const page = request ? new URL(request.url).searchParams.get('page') : null;
	const r = await reponsePlanDesActes({ db: env.DEPOTS, page });
	return new Response(r.corps, { status: r.statut, headers: r.entetes });
}
