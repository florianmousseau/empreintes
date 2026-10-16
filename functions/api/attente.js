// POST /api/attente : le formulaire de la liste d'attente d'une offre (D-200), envoye sans script.
// Rend une page : l'adresse est notee, ou la raison du refus. Un robot recoit la meme page qu'une personne.
import { inscrire, lireInscription, offreConnue } from '../../src/attente.mjs';
import { pageAttente } from '../../src/pages.mjs';

const HTML = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' };
const STATUTS = { inscrit: 200, adresse: 400, offre: 400, plafond: 429 };

export async function onRequestPost({ request, env }) {
	const formulaire = await request.formData().catch(() => new FormData());
	const champs = Object.fromEntries(formulaire);
	const lue = lireInscription(champs);
	const issue = lue.robot ? 'inscrit' : (lue.refus ?? (await inscrire(env.DEPOTS, lue, new Date().toISOString().slice(0, 10))));
	// La page de reponse renvoie a l'offre du formulaire ; une offre inconnue renvoie a la premiere.
	return new Response(pageAttente(issue, offreConnue(champs.offre) ?? undefined), { status: STATUTS[issue], headers: HTML });
}
