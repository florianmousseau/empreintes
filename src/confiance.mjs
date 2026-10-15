// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Florian Mousseau. Ce fichier seul est sous licence MIT
// (LICENSES/MIT.txt) pour que tout logiciel, ouvert ou ferme, puisse verifier.
// Les autorites de certification des listes de confiance europeennes : la
// liste des listes de la Commission (LOTL) pointe chaque liste nationale, qui
// porte ses services avec leur type (ETSI TS 119 612) et leur statut. On ne
// retient que les services en vigueur (`granted`) de type CA/QC, l'empreinte
// de leurs certificats, leur pays et ce qu'ils emettent (signatures, cachets).
// Pur : la lecture du reseau est dans `scripts/confiance.mjs`.

import { sha256 } from './chaine.mjs';

export const URL_LOTL = 'https://ec.europa.eu/tools/lotl/eu-lotl.xml';
export const TYPE_CA_QC = 'http://uri.etsi.org/TrstSvc/Svctype/CA/QC';
/** En deca, le releve est tronque (une liste muette, un format change) et ne se publie pas. */
export const PLANCHER_AUTORITES = 500;
const USAGES = { ForeSignatures: 'signatures', ForeSeals: 'cachets' };

/** Le contenu de chaque balise `nom`, avec ou sans prefixe d'espace de noms. */
const balises = (xml, nom) => [...xml.matchAll(new RegExp(`<(?:[\\w-]+:)?${nom}\\b[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${nom}>`, 'g'))].map((m) => m[1].trim());

const texteXml = (t) =>
	t.replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[e]);

/** Les listes nationales XML que pointe la LOTL, `[{ pays, url }]`, sans la LOTL elle-meme. */
export function listesNationales(lotl) {
	return balises(lotl, 'OtherTSLPointer')
		.map((p) => ({ pays: balises(p, 'SchemeTerritory')[0], url: balises(p, 'TSLLocation')[0], type: balises(p, 'MimeType')[0] ?? '' }))
		.filter((l) => l.pays && l.pays !== 'EU' && l.url && /xml/i.test(l.type))
		.map(({ pays, url }) => ({ pays, url: texteXml(url) }));
}

/**
 * Les autorites en vigueur d'une liste nationale : `[{ nom, usages, certificats }]`,
 * les certificats en base64. L'information courante seulement, jamais l'historique.
 */
export function autoritesDeLaListe(xml) {
	return balises(xml, 'TSPService')
		.map((service) => service.split(/<(?:[\w-]+:)?ServiceHistory\b/)[0])
		.filter((courant) => balises(courant, 'ServiceTypeIdentifier')[0] === TYPE_CA_QC && (balises(courant, 'ServiceStatus')[0] ?? '').endsWith('/granted'))
		.map((courant) => ({
			nom: texteXml(balises(balises(courant, 'ServiceName')[0] ?? '', 'Name')[0] ?? ''),
			usages: [...new Set(balises(courant, 'URI').map((u) => USAGES[u.split('/').at(-1)]).filter(Boolean))].sort(),
			certificats: balises(balises(courant, 'ServiceDigitalIdentity')[0] ?? '', 'X509Certificate').map((c) => c.replace(/\s+/g, ''))
		}));
}

const octetsBase64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/**
 * Le registre publie des autorites : l'empreinte (sha256 du DER) de chaque
 * certificat vers son pays, son nom et ses usages. `lectures` : `[{ pays, xml }]`,
 * une liste illisible (`xml` null) nommee a part.
 */
export async function registreDesAutorites(lectures, lu) {
	const autorites = {};
	const illisibles = [];
	for (const { pays, xml } of lectures) {
		if (!xml) {
			illisibles.push(pays);
			continue;
		}
		for (const a of autoritesDeLaListe(xml))
			for (const c of a.certificats) {
				try {
					autorites[await sha256(octetsBase64(c))] = { pays, nom: a.nom, usages: a.usages };
				} catch {
					// un certificat mal encode dans une liste nationale ne fait pas tomber les autres
				}
			}
	}
	return { lu, illisibles: illisibles.sort(), autorites };
}
