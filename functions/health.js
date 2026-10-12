// La sonde de la surface : 200 dans tous les cas, `alerte` dit si le journal publie est encore frais.
import { verdict } from '../src/journal.mjs';

async function lireAsset(env, url, chemin) {
	const r = await env.ASSETS.fetch(new URL(chemin, url));
	return r.ok ? r.json() : null;
}

export async function onRequestGet({ request, env }) {
	const [liste, version] = await Promise.all([lireAsset(env, request.url, '/tours.json'), lireAsset(env, request.url, '/version.json')]);
	const tours = liste?.tours ?? [];
	const dernier = tours.at(-1) ?? null;
	const corps = {
		service: 'empreintes',
		...verdict(tours, new Date(), liste?.copie ?? null),
		copie: liste?.copie ?? null,
		dernierTour: dernier && { id: dernier.id, racine: dernier.racine, objets: dernier.objets, ots: dernier.ots, bloc: dernier.bloc },
		tours: tours.length,
		deploye: { commit: version?.commit ?? 'inconnu', construit: version?.construit ?? null }
	};
	return new Response(`${JSON.stringify(corps, null, 1)}\n`, {
		headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*' }
	});
}
