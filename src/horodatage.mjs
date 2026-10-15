// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Florian Mousseau. Ce fichier seul est sous licence MIT
// (LICENSES/MIT.txt) pour que tout logiciel, ouvert ou ferme, puisse verifier.
// L'horodatage qualifie d'une racine (RFC 3161, `<tour>.racine.tsr`), relu sans
// dependance : la reponse est accordee, l'empreinte horodatee est celle de la
// racine, la signature tient sous le certificat du signataire, et ce
// certificat est emis par une autorite de la liste de confiance europeenne
// dont l'empreinte est epinglee ici. Le meme fichier tourne dans le navigateur
// et sous Node.

/**
 * Les autorites d'horodatage qualifiees reconnues : sha256 du DER du
 * certificat de l'autorite, tel que sa liste de confiance nationale le publie
 * comme identite du service QTST `granted`.
 */
export const AUTORITES_QUALIFIEES = [
	{
		empreinte: 'cd0a3e00a1bdae3a159fa9e3d70f8e664f560fdce16357cbe440ed0b0d88244f',
		nom: 'Sectigo Qualified Time Stamping CA R35',
		liste: 'https://tsl.digital.gob.es/TSL.xml'
	}
];

const OID = {
	signedData: '2a864886f70d010702',
	tstInfo: '2a864886f70d0109100104',
	contentType: '2a864886f70d010903',
	messageDigest: '2a864886f70d010904',
	horodatage: '2b06010505070308'
};
const CONDENSATS = { '608648016503040201': 'SHA-256', '608648016503040202': 'SHA-384', '608648016503040203': 'SHA-512' };
const SIGNATURES_RSA = { '2a864886f70d01010b': 'SHA-256', '2a864886f70d01010c': 'SHA-384', '2a864886f70d01010d': 'SHA-512' };
const RSA = '2a864886f70d010101';

const hex = (octets) => Array.from(octets, (o) => o.toString(16).padStart(2, '0')).join('');
const egaux = (a, b) => a.length === b.length && a.every((o, i) => o === b[i]);
const condensat = async (algorithme, octets) => new Uint8Array(await globalThis.crypto.subtle.digest(algorithme, octets));

/** L'element DER a `pos` : son etiquette, ses octets entiers, son contenu. */
export function element(octets, pos) {
	if (pos + 2 > octets.length) throw new Error('DER tronque');
	let longueur = octets[pos + 1];
	let debut = pos + 2;
	if (longueur > 0x7f) {
		const n = longueur & 0x7f;
		longueur = 0;
		for (let i = 0; i < n; i++) longueur = longueur * 256 + octets[debut + i];
		debut += n;
	}
	const fin = debut + longueur;
	if (Number.isNaN(longueur) || fin > octets.length) throw new Error('DER tronque');
	return { etiquette: octets[pos], entier: octets.subarray(pos, fin), contenu: octets.subarray(debut, fin) };
}

/** Les elements contenus dans un element construit. */
export function enfants(el) {
	const liste = [];
	for (let pos = 0; pos < el.contenu.length; pos += liste.at(-1).entier.length) liste.push(element(el.contenu, pos));
	return liste;
}

/** L'instant d'un UTCTime (0x17) ou d'un GeneralizedTime (0x18), en millisecondes. */
function instantDer(el) {
	const t = new TextDecoder().decode(el.contenu);
	const m = el.etiquette === 0x17 ? /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/.exec(t) : /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\.\d+)?Z$/.exec(t);
	if (!m) throw new Error(`date illisible : ${t}`);
	const annee = el.etiquette === 0x17 ? 2000 + Number(m[1]) - (Number(m[1]) >= 50 ? 100 : 0) : Number(m[1]);
	return Date.UTC(annee, Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]));
}

/** Ce qu'on lit d'un certificat X.509 : tbs, numero, emetteur, sujet, validite, cle, signature. */
export function certificat(entier) {
	const [tbs, algorithme, signature] = enfants(element(entier, 0));
	const champs = enfants(tbs);
	const i = champs[0].etiquette === 0xa0 ? 1 : 0;
	const [debut, fin] = enfants(champs[i + 3]).map(instantDer);
	return {
		entier,
		tbs: tbs.entier,
		numero: hex(champs[i].contenu),
		emetteur: hex(champs[i + 2].entier),
		nomEmetteur: champs[i + 2],
		nomSujet: champs[i + 4],
		debut,
		fin,
		spki: champs[i + 5].entier,
		extensions: hex(champs.at(-1).entier),
		algorithme: hex(enfants(algorithme)[0].contenu),
		signature: signature.contenu.subarray(1)
	};
}

/** Une signature RSA PKCS#1 v1.5 sous la cle `spki`, avec le condensat nomme. */
async function signatureRsa(spki, hache, signature, donnees) {
	try {
		const cle = await globalThis.crypto.subtle.importKey('spki', spki, { name: 'RSASSA-PKCS1-v1_5', hash: hache }, false, ['verify']);
		return await globalThis.crypto.subtle.verify('RSASSA-PKCS1-v1_5', cle, signature, donnees);
	} catch {
		return false;
	}
}

/** Les parties d'une reponse d'horodatage : statut, TSTInfo, certificats, signataire. */
function lireReponse(tsr) {
	const [statut, jeton] = enfants(element(tsr, 0));
	const etat = enfants(statut)[0].contenu[0];
	if (!jeton) return { etat };
	const [type, contenu] = enfants(jeton);
	if (hex(type.contenu) !== OID.signedData) throw new Error("le jeton n'est pas un SignedData");
	const signedData = enfants(enfants(contenu)[0]);
	const [typeEncapsule, enveloppe] = enfants(signedData[2]);
	const certificats = signedData.filter((e) => e.etiquette === 0xa0).flatMap((e) => enfants(e).map((c) => certificat(c.entier)));
	const [, sid, algorithme, attributs, , signature] = enfants(enfants(signedData.at(-1))[0]);
	return {
		etat,
		typeEncapsule: hex(typeEncapsule.contenu),
		tstInfo: enfants(enveloppe)[0].contenu,
		certificats,
		sid: sid.etiquette === 0x30 ? { emetteur: hex(enfants(sid)[0].entier), numero: hex(enfants(sid)[1].contenu) } : null,
		condensat: CONDENSATS[hex(enfants(algorithme)[0].contenu)] ?? null,
		attributs: Object.fromEntries(enfants(attributs).map((a) => [hex(enfants(a)[0].contenu), enfants(enfants(a)[1])[0]])),
		attributsSignes: Uint8Array.of(0x31, ...attributs.entier.subarray(1)),
		signature: signature.contenu
	};
}

/** Ce que l'autorite a horodate : algorithme et empreinte, et l'instant. */
function lireTstInfo(octets) {
	const champs = enfants(element(octets, 0));
	const [algorithme, empreinte] = enfants(champs[2]);
	return { condensat: CONDENSATS[hex(enfants(algorithme)[0].contenu)] ?? null, empreinte: empreinte.contenu, instant: instantDer(champs[4]) };
}

/** Le certificat de l'autorite epinglee qui a emis `signataire`, signature relue ; null sinon. */
async function autoriteDe(signataire, certificats, autorites) {
	for (const c of certificats) {
		const empreinte = hex(await condensat('SHA-256', c.entier));
		const autorite = autorites.find((a) => a.empreinte === empreinte);
		const hache = SIGNATURES_RSA[signataire.algorithme];
		if (autorite && hache && (await signatureRsa(c.spki, hache, signataire.signature, signataire.tbs))) return autorite;
	}
	return null;
}

/** Les ecarts du signataire : sa signature sur les attributs, son usage, sa validite a l'instant horodate. */
async function ecartsDuSignataire(r, signataire, instant) {
	const raisons = [];
	if (!r.condensat || !(await signatureRsa(signataire.spki, r.condensat, r.signature, r.attributsSignes))) raisons.push('la signature ne correspond pas');
	if (!signataire.extensions.includes(OID.horodatage)) raisons.push("le certificat du signataire n'est pas un certificat d'horodatage");
	if (instant < signataire.debut || instant > signataire.fin) raisons.push("l'instant est hors de la validite du certificat du signataire");
	return raisons;
}

/**
 * Relit l'horodatage qualifie `tsr` (octets d'une TimeStampResp) contre la
 * racine du tour : empreinte SHA-256 de `racine + "\n"`, les octets du fichier
 * `<tour>.racine`. Rend `{ ok, raisons, instant, autorite }`, l'instant en ISO.
 */
export async function verifierHorodatage(tsr, racine, autorites = AUTORITES_QUALIFIEES) {
	let r;
	try {
		r = lireReponse(tsr);
	} catch {
		return { ok: false, raisons: ['horodatage illisible'], instant: null, autorite: null };
	}
	if (r.etat > 1 || !r.tstInfo) return { ok: false, raisons: [`horodatage refuse par l'autorite (statut ${r.etat})`], instant: null, autorite: null };
	const raisons = [];
	let t;
	try {
		t = lireTstInfo(r.tstInfo);
	} catch {
		return { ok: false, raisons: ['horodatage illisible'], instant: null, autorite: null };
	}
	const attendue = await condensat('SHA-256', new TextEncoder().encode(`${racine}\n`));
	if (t.condensat !== 'SHA-256' || !egaux(t.empreinte, attendue)) raisons.push("l'empreinte horodatee n'est pas celle de la racine du tour");
	if (r.typeEncapsule !== OID.tstInfo || hex(r.attributs[OID.contentType]?.contenu ?? []) !== OID.tstInfo) raisons.push("le contenu signe n'est pas un TSTInfo");
	const digest = r.condensat ? await condensat(r.condensat, r.tstInfo) : null;
	if (!digest || !egaux(r.attributs[OID.messageDigest]?.contenu ?? new Uint8Array(), digest)) raisons.push('le TSTInfo a change depuis la signature');
	const signataire = r.certificats.find((c) => r.sid && c.numero === r.sid.numero && c.emetteur === r.sid.emetteur);
	if (!signataire) return { ok: false, raisons: [...raisons, 'certificat du signataire absent'], instant: null, autorite: null };
	raisons.push(...(await ecartsDuSignataire(r, signataire, t.instant)));
	const autorite = await autoriteDe(signataire, r.certificats, autorites);
	if (!autorite) raisons.push("le signataire n'est pas emis par une autorite qualifiee epinglee");
	return { ok: raisons.length === 0, raisons, instant: new Date(t.instant).toISOString().replace('.000Z', 'Z'), autorite: autorite?.nom ?? null };
}

/** Le premier tour a partir de `id` (lui compris) qui porte un horodatage qualifie ; null sinon. */
export function tourHorodate(tours, id) {
	const i = tours.findIndex((t) => t.id === id);
	return i < 0 ? null : (tours.slice(i).find((t) => t.fichiers?.includes(`${t.id}.racine.tsr`)) ?? null);
}

/**
 * Les horodatages qualifies de toute la liste des tours (`tours.json`) :
 * chaque `.racine.tsr` relu contre la racine de son tour. `lireOctets(chemin)`
 * rend les octets d'un fichier publie. Rend le compte et les raisons d'un ecart.
 */
export async function verifierHorodatages(tours, lireOctets) {
	const raisons = [];
	let horodates = 0;
	for (const t of tours.filter((t) => t.fichiers?.includes(`${t.id}.racine.tsr`))) {
		const v = await verifierHorodatage(await lireOctets(`/empreintes/${t.id}.racine.tsr`), t.racine);
		horodates += 1;
		raisons.push(...v.raisons.map((r) => `${t.id} : ${r}`));
	}
	return { ok: raisons.length === 0, horodates, raisons };
}
