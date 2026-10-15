// Le certificat d'une serie d'affichage de permis (D-166, edifiable) : la liste
// des recus d'une photo par jour, relue ici contre le registre. Pur : la page
// passe la lecture d'une ligne publique, les tests la simulent.
//
// Le fichier, ecrit par la page du certificat d'edifiable :
//   {"type":"certificat-affichage","version":1,
//    "permis":"PC 069 123 24 A0001","pose":"AAAA-MM-JJ","fin":"AAAA-MM-JJ",
//    "jours":[{"jour":"AAAA-MM-JJ","sha256":"<64 hex>","recu":"<64 hex>",
//              "complet":{<le recu version 3, facultatif>}}, ...]}
// `jours` ne porte que les jours photographies, dans l'ordre, un au plus par
// jour. La fin se RECALCULE ici depuis la pose (deux mois, R. 600-2 du code de
// l'urbanisme) : un certificat qui ecourte sa periode est refuse.
//
// Ce que la verification etablit, et seulement cela : chaque photo dont
// l'empreinte est listee etait au registre le jour dit, a la place dite. La
// ligne publique ne porte pas le numero du permis ; il n'est relu que dans un
// recu complet joint, dont l'identifiant se recalcule. Les photos restent au
// dossier du petitionnaire : deposee sur /verifier, chacune retrouve son jour.

import { numeroDePermis } from './affichage.mjs';
import { estUnRecu, idDuRecu } from './depot.mjs';

export const TYPE_DU_CERTIFICAT = 'certificat-affichage';
export const VERSION_DU_CERTIFICAT = 1;

const HEX64 = /^[0-9a-f]{64}$/;
const JOUR = /^\d{4}-\d{2}-\d{2}$/;
const JOUR_MS = 86_400_000;

const lireJour = (j) => (typeof j === 'string' && JOUR.test(j) && new Date(`${j}T00:00:00Z`).toISOString().slice(0, 10) === j ? Date.parse(`${j}T00:00:00Z`) : null);
const ecrireJour = (t) => new Date(t).toISOString().slice(0, 10);

/** Le dernier jour d'affichage : deux mois apres la pose, ou le dernier jour du mois qui n'a pas ce quantieme. */
export function finDeLAffichage(pose) {
	const d = new Date(lireJour(pose));
	const annee = d.getUTCFullYear();
	const mois = d.getUTCMonth() + 2;
	const dernier = new Date(Date.UTC(annee, mois + 1, 0)).getUTCDate();
	return ecrireJour(Date.UTC(annee, mois, Math.min(d.getUTCDate(), dernier)));
}

/** Chaque jour de la pose a la fin, bornes comprises. */
export function joursDAffichage(pose) {
	const jours = [];
	for (let t = lireJour(pose), fin = lireJour(finDeLAffichage(pose)); t <= fin; t += JOUR_MS) jours.push(ecrireJour(t));
	return jours;
}

/** Vrai quand la valeur se presente comme un certificat de serie, lisible ou non. */
export const estUnCertificat = (v) => v !== null && typeof v === 'object' && v.type === TYPE_DU_CERTIFICAT;

/**
 * Lit un certificat de serie. Rend `{ certificat }`, remis en forme (permis
 * canonique, fin recalculee), ou `{ erreur }` avec le premier defaut trouve.
 */
export function lireCertificat(v) {
	if (!estUnCertificat(v)) return { erreur: 'type' };
	if (v.version !== VERSION_DU_CERTIFICAT) return { erreur: 'version' };
	const permis = numeroDePermis(v.permis);
	if (!permis) return { erreur: 'permis' };
	if (lireJour(v.pose) === null) return { erreur: 'pose' };
	const fin = finDeLAffichage(v.pose);
	if (v.fin !== undefined && v.fin !== fin) return { erreur: 'fin' };
	if (!Array.isArray(v.jours)) return { erreur: 'jours' };
	const jours = [];
	for (const j of v.jours) {
		if (j === null || typeof j !== 'object' || lireJour(j.jour) === null || !HEX64.test(j.sha256 ?? '') || !HEX64.test(j.recu ?? '')) return { erreur: 'jours' };
		if (j.jour < v.pose || j.jour > fin) return { erreur: 'hors-periode' };
		if (jours.length > 0 && j.jour <= jours.at(-1).jour) return { erreur: 'ordre' };
		if (j.complet !== undefined && (j.complet === null || typeof j.complet !== 'object')) return { erreur: 'jours' };
		jours.push({ jour: j.jour, sha256: j.sha256, recu: j.recu, ...(j.complet ? { complet: j.complet } : {}) });
	}
	return { certificat: { permis, pose: v.pose, fin, jours } };
}

/** Le numero du permis dans un recu complet : `relu` s'il est le bon recu et le bon numero, `autre` sinon. */
async function permisDuRecu(jour, permis) {
	const r = jour.complet;
	if (!r) return 'non-relu';
	const meme = estUnRecu(r) && r.sha256 === jour.sha256 && r.jour === jour.jour && (await idDuRecu(r)) === jour.recu;
	return meme && r.affichage?.permis === permis ? 'relu' : 'autre';
}

/**
 * Le verdict d'un jour, contre sa ligne publique (`null` quand le registre ne
 * connait pas le recu) : `au-registre`, `inconnu`, `different` (la ligne ne
 * porte pas cette empreinte ce jour-la) ou `autre-permis` (le recu joint nomme
 * un autre permis, ou n'est pas celui de la ligne).
 */
export async function verdictDuJour(jour, ligne, permis) {
	if (!ligne) return { ...jour, verdict: 'inconnu' };
	if (ligne.recu !== jour.recu || ligne.sha256 !== jour.sha256 || ligne.jour !== jour.jour) return { ...jour, verdict: 'different' };
	const lu = await permisDuRecu(jour, permis);
	return { ...jour, place: ligne.place, permis: lu, verdict: lu === 'autre' ? 'autre-permis' : 'au-registre' };
}

/**
 * Relit tout le certificat. `ligneDuRecu(id)` rend la ligne publique du recu,
 * ou null ; `aujourdhui` borne les jours a venir, qui ne manquent pas encore.
 * Rend chaque jour de la periode avec son statut, et le bilan.
 */
export async function verifierLeCertificat(certificat, ligneDuRecu, aujourdhui) {
	const relus = await Promise.all(certificat.jours.map(async (j) => verdictDuJour(j, await ligneDuRecu(j.recu), certificat.permis)));
	const parJour = new Map(relus.map((j) => [j.jour, j]));
	const jours = joursDAffichage(certificat.pose).map((jour) => parJour.get(jour) ?? { jour, verdict: jour > aujourdhui ? 'a-venir' : 'sans-photo' });
	const compte = (v) => jours.filter((j) => j.verdict === v).length;
	const auRegistre = compte('au-registre');
	const refuses = compte('inconnu') + compte('different') + compte('autre-permis');
	const sansPhoto = compte('sans-photo');
	return {
		permis: certificat.permis,
		pose: certificat.pose,
		fin: certificat.fin,
		jours,
		total: jours.length,
		auRegistre,
		refuses,
		sansPhoto,
		aVenir: compte('a-venir'),
		permisRelus: jours.filter((j) => j.permis === 'relu').length,
		conforme: refuses === 0,
		continue: refuses === 0 && sansPhoto === 0,
		premierManque: jours.find((j) => j.verdict === 'sans-photo')?.jour ?? null
	};
}
