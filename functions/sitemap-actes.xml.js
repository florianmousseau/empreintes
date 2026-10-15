// GET /sitemap-actes.xml : l'adresse perenne de chaque acte date (D-205).
import { reponsePlanDesActes } from '../src/collectivite.mjs';

export async function onRequestGet({ env }) {
	const r = await reponsePlanDesActes({ db: env.DEPOTS });
	return new Response(r.corps, { status: r.statut, headers: r.entetes });
}
