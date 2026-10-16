// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Florian Mousseau. Ce fichier seul est sous licence MIT
// (LICENSES/MIT.txt) pour que tout logiciel, ouvert ou ferme, puisse verifier.
// Les autorites de certification des listes de confiance europeennes : la
// liste des listes de la Commission (LOTL) pointe chaque liste nationale, qui
// porte ses services avec leur type (ETSI TS 119 612), leur statut et
// l'historique de ce statut. On retient les services CA/QC qui ont ete en
// vigueur un jour, l'empreinte de leurs certificats, leur pays, ce qu'ils
// emettent (signatures, cachets) et les periodes ou ils l'etaient : un
// certificat se juge au statut de son autorite a l'instant ou il a ete emis
// (ETSI TS 119 615), pas a celui du jour. Pur : la lecture du reseau est dans
// `scripts/confiance.mjs`.

import { sha256 } from './chaine.mjs';

export const URL_LOTL = 'https://ec.europa.eu/tools/lotl/eu-lotl.xml';
export const TYPE_CA_QC = 'http://uri.etsi.org/TrstSvc/Svctype/CA/QC';
/** En deca, le releve est tronque (une liste muette, un format change) et ne se publie pas. */
export const PLANCHER_AUTORITES = 500;
const USAGES = { ForeSignatures: 'signatures', ForeSeals: 'cachets' };
/**
 * Les statuts qui valent inscription : `granted` sous eIDAS (depuis le
 * 1er juillet 2016), et ses equivalents sous la directive 1999/93 avant cette
 * date (ETSI TS 119 615, 4.1.4).
 */
const EN_VIGUEUR = new Set(['granted', 'undersupervision', 'supervisionincessation', 'accredited']);

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


/** L'information courante d'un service puis chaque instance de son historique. */
function instancesDuService(service) {
	const [courant, historique] = service.split(/<(?:[\w-]+:)?ServiceHistory\b/);
	return [courant, ...(historique === undefined ? [] : balises(historique, 'ServiceHistoryInstance'))];
}

/**
 * Les periodes ou le service etait une autorite CA/QC en vigueur,
 * `[[debut, fin]]` en ISO, `fin` null pour celle qui court. Chaque statut
 * vaut de son `StatusStartingTime` au suivant ; deux periodes qui se
 * touchent n'en font qu'une.
 */
function periodesEnVigueur(instances) {
	const statuts = instances
		.map((i) => ({
			depuis: balises(i, 'StatusStartingTime')[0] ?? null,
			valide: balises(i, 'ServiceTypeIdentifier')[0] === TYPE_CA_QC && EN_VIGUEUR.has((balises(i, 'ServiceStatus')[0] ?? '').split('/').at(-1))
		}))
		.sort((a, b) => (a.depuis ?? '').localeCompare(b.depuis ?? ''));
	const periodes = [];
	statuts.forEach(({ depuis, valide }, n) => {
		if (!valide) return;
		const jusqua = statuts[n + 1]?.depuis ?? null;
		const derniere = periodes.at(-1);
		if (derniere && derniere[1] === depuis) derniere[1] = jusqua;
		else periodes.push([depuis, jusqua]);
	});
	return periodes;
}

/**
 * Les autorites CA/QC d'une liste nationale qui ont ete en vigueur un jour :
 * `[{ nom, usages, certificats, periodes }]`, les certificats en base64, ceux
 * de l'information courante et de l'historique ; nom et usages sont ceux du jour.
 */
export function autoritesDeLaListe(xml) {
	return balises(xml, 'TSPService')
		.map((service) => {
			const instances = instancesDuService(service);
			const [courant] = instances;
			return {
				nom: texteXml(balises(balises(courant, 'ServiceName')[0] ?? '', 'Name')[0] ?? ''),
				usages: [...new Set(balises(courant, 'URI').map((u) => USAGES[u.split('/').at(-1)]).filter(Boolean))].sort(),
				certificats: [...new Set(instances.flatMap((i) => balises(balises(i, 'ServiceDigitalIdentity')[0] ?? '', 'X509Certificate').map((c) => c.replace(/\s+/g, ''))))],
				periodes: periodesEnVigueur(instances)
			};
		})
		.filter((a) => a.periodes.length > 0);
}

const octetsBase64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const parDebut = (x, y) => (x[0] ?? '').localeCompare(y[0] ?? '');

/**
 * Le registre publie des autorites : l'empreinte (sha256 du DER) de chaque
 * certificat vers son pays, son nom, ses usages et ses periodes en vigueur ; un
 * certificat porte par deux services garde le premier nom et les periodes des
 * deux. `lectures` : `[{ pays, xml }]`, une liste illisible (`xml` null) nommee a part.
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
					const cle = await sha256(octetsBase64(c));
					const deja = autorites[cle];
					autorites[cle] = deja ? { ...deja, periodes: [...deja.periodes, ...a.periodes].sort(parDebut) } : { pays, nom: a.nom, usages: a.usages, periodes: a.periodes };
				} catch {
					// un certificat mal encode dans une liste nationale ne fait pas tomber les autres
				}
			}
	}
	return { lu, illisibles: illisibles.sort(), autorites };
}
