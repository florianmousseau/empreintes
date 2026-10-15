// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Florian Mousseau. Ce fichier seul est sous licence MIT
// (LICENSES/MIT.txt) pour que tout logiciel, ouvert ou ferme, puisse verifier.
// La signature du deposant : l'origine d'un depot, prouvee par celui qui le
// fait (D-164, REQ-7.5-03 du reglement d'execution 2025/2531). Un JWS compact
// JAdES dont la charge utile est l'empreinte du document (64 hex minuscules),
// jointe ou detachee, et dont le certificat voyage dans `x5c`. Le service
// verifie la signature sous la cle du certificat et sa validite a l'instant du
// depot ; il ne juge pas l'emetteur : c'est le certificat qui le nomme, et le
// recu le recopie. Le meme fichier tourne dans le navigateur et sous Node.

import { sha256 } from './chaine.mjs';
import { certificat, enfants } from './horodatage.mjs';

/** Au plus autant de caracteres pour une signature : un certificat et sa chaine y tiennent. */
export const SIGNATURE_MAX = 32768;

/** Les algorithmes admis, ceux de JAdES que WebCrypto relit. */
const ALGORITHMES = {
	ES256: { cle: { name: 'ECDSA', namedCurve: 'P-256' }, verification: { name: 'ECDSA', hash: 'SHA-256' } },
	ES384: { cle: { name: 'ECDSA', namedCurve: 'P-384' }, verification: { name: 'ECDSA', hash: 'SHA-384' } },
	RS256: { cle: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, verification: { name: 'RSASSA-PKCS1-v1_5' } },
	PS256: { cle: { name: 'RSA-PSS', hash: 'SHA-256' }, verification: { name: 'RSA-PSS', saltLength: 32 } }
};
/** Les en-tetes critiques que le service comprend ; tout autre fait refuser la signature (RFC 7515, 4.1.11). */
const CRITIQUES_COMPRIS = ['sigT'];
/** QcCompliance (ETSI EN 319 412-5) : le certificat se declare conforme a l'annexe I d'eIDAS. */
const QC_COMPLIANCE = '060604008e460101';
const ATTRIBUTS = { '550403': 'CN', '55040a': 'O' };

const HEX64 = /^[0-9a-f]{64}$/;
const JWS = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+$/;
const encodeur = new TextEncoder();
const hex = (octets) => Array.from(octets, (o) => o.toString(16).padStart(2, '0')).join('');

const depuisBase64 = (texte) => {
	const b64 = texte.replace(/-/g, '+').replace(/_/g, '/');
	return Uint8Array.from(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0));
};
const versBase64Url = (octets) => btoa(String.fromCharCode(...octets)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Vrai quand le texte a la forme d'un JWS compact, charge jointe ou detachee. */
export const estUnJws = (texte) => typeof texte === 'string' && texte.length <= SIGNATURE_MAX && JWS.test(texte);

/** La valeur texte d'un attribut de nom : BMPString en UTF-16, le reste en UTF-8. */
const texteDe = (el) => (el.etiquette === 0x1e ? new TextDecoder('utf-16be').decode(el.contenu) : new TextDecoder().decode(el.contenu));

/** Le nom lisible d'un Name X.509 : son nom commun et son organisation, sans doublon. */
export function nomLisible(nom) {
	const valeurs = {};
	for (const rdn of enfants(nom))
		for (const attribut of enfants(rdn)) {
			const [oid, valeur] = enfants(attribut);
			const cle = ATTRIBUTS[hex(oid.contenu)];
			if (cle && !valeurs[cle]) valeurs[cle] = texteDe(valeur).trim();
		}
	return [...new Set([valeurs.CN, valeurs.O].filter(Boolean))].join(', ') || null;
}

/** L'en-tete et le certificat d'un JWS, ou la raison pour laquelle on ne les lit pas. */
function lireEnTete(morceau) {
	let entete;
	try {
		entete = JSON.parse(new TextDecoder().decode(depuisBase64(morceau)));
	} catch {
		return { refus: 'en-tete illisible' };
	}
	if (!Array.isArray(entete?.x5c) || typeof entete.x5c[0] !== 'string') return { refus: 'certificat absent (x5c)' };
	try {
		const der = depuisBase64(entete.x5c[0]);
		return { entete, der, cert: certificat(der) };
	} catch {
		return { refus: 'certificat illisible' };
	}
}

/** Les ecarts de l'en-tete : algorithme admis, en-tetes critiques compris, `x5t#S256` qui designe le certificat. */
async function ecartsDeLEnTete(entete, der) {
	const raisons = [];
	if (!ALGORITHMES[entete.alg]) raisons.push(`algorithme ${entete.alg} non admis`);
	const critiques = entete.crit ?? [];
	if (!Array.isArray(critiques) || critiques.some((c) => !CRITIQUES_COMPRIS.includes(c) || !(c in entete))) raisons.push('en-tete critique non compris');
	if (entete['x5t#S256'] !== undefined && entete['x5t#S256'] !== versBase64Url(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', der))))
		raisons.push('x5t#S256 ne designe pas le certificat');
	return raisons;
}

async function signatureJuste(algorithme, spki, signature, donnees) {
	try {
		const cle = await globalThis.crypto.subtle.importKey('spki', spki, algorithme.cle, false, ['verify']);
		return await globalThis.crypto.subtle.verify(algorithme.verification, cle, signature, donnees);
	} catch {
		return false;
	}
}

/**
 * Relit la signature d'un deposant contre l'empreinte de son document, a
 * l'instant du depot. Rend `{ ok, raisons, certificat }` ; `certificat` porte
 * l'empreinte du DER, le nom du sujet et de l'emetteur, la fin de validite et
 * `qcCompliance`, ou null quand il ne se lit pas.
 */
export async function verifierSignatureDuDeposant(jws, empreinte, instant) {
	if (!estUnJws(jws)) return { ok: false, raisons: ['pas un JWS compact'], certificat: null };
	if (!HEX64.test(empreinte ?? '')) return { ok: false, raisons: ['empreinte illisible'], certificat: null };
	const [h, charge, s] = jws.split('.');
	const lu = lireEnTete(h);
	if (lu.refus) return { ok: false, raisons: [lu.refus], certificat: null };
	const { entete, der, cert } = lu;
	const raisons = await ecartsDeLEnTete(entete, der);
	const detachee = charge === '';
	if (!detachee && new TextDecoder().decode(depuisBase64(charge)) !== empreinte) raisons.push("la charge utile n'est pas l'empreinte du document");
	const t = Date.parse(instant);
	if (!(t >= cert.debut && t <= cert.fin)) raisons.push("le certificat n'est pas valide a l'instant du depot");
	const signee = encodeur.encode(`${h}.${detachee ? versBase64Url(encodeur.encode(empreinte)) : charge}`);
	if (ALGORITHMES[entete.alg] && !(await signatureJuste(ALGORITHMES[entete.alg], cert.spki, depuisBase64(s), signee))) raisons.push('la signature ne correspond pas');
	return {
		ok: raisons.length === 0,
		raisons,
		certificat: {
			empreinte: await sha256(der),
			sujet: nomLisible(cert.nomSujet),
			emetteur: nomLisible(cert.nomEmetteur),
			jusquau: new Date(cert.fin).toISOString(),
			qcCompliance: cert.extensions.includes(QC_COMPLIANCE)
		}
	};
}
