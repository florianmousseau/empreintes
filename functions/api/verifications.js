// POST /api/verifications : un recu, tel que POST /api/depots l'a rendu, relu par le service (D-195).
// Fermee tant que `OFFRE_API` ne vaut pas `ouverte` : 404, comme une adresse qui n'existe pas.
import { offreOuverte } from '../../src/client.mjs';
import { verifierUnRecu } from '../../src/service.mjs';
import { autoritesDesActifs } from '../../src/confiance.mjs';

const JSON_UTF8 = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

export async function onRequestPost({ request, env }) {
	if (!offreOuverte(env)) return new Response(`${JSON.stringify({ erreur: 'inconnu', details: [] })}\n`, { status: 404, headers: JSON_UTF8 });
	let corps;
	try {
		corps = await request.json();
	} catch {
		corps = null;
	}
	const lire = (chemin) => env.ASSETS.fetch(new URL(chemin, request.url));
	const r = await verifierUnRecu({ db: env.DEPOTS, corps, lire, autorites: autoritesDesActifs(env, request.url) });
	return new Response(r.corps, { status: r.statut, headers: r.entetes });
}
