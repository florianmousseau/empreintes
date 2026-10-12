// GET /api/bilan : depots et deposants distincts, jour par jour.
import { bilanPublic, lecturePublique } from '../../src/service.mjs';

export async function onRequestGet({ env }) {
	const r = lecturePublique(await bilanPublic({ db: env.DEPOTS }));
	return new Response(r.corps, { status: r.statut, headers: r.entetes });
}
