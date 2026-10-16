// Le schema ouvert de l'adresse perenne d'un acte local (D-205), version 1 :
// la forme, les regles de resolution, la fiche servie en JSON a l'adresse et ce
// que l'API en porte. Ecrit comme un profil local d'ELI (juridiction, type,
// date, identifiant naturel) pour se lire a cote de Legifrance. Construit depuis
// les constantes que le resolveur applique, jamais recopie : `/schema/` sert ce
// fichier tel quel, et la page `/adresse-des-actes` l'affiche. Pur.

import { MOTIF_COLLECTIVITE, NATURES } from './acte.mjs';
import { HEX_CANONIQUES, HEX_MINIMUM } from './adresse.mjs';
import { AMBIGUS_MAX } from './service.mjs';

export const VERSION_DU_SCHEMA = 1;
export const CHEMIN_DU_SCHEMA = `/schema/adresse-des-actes/${VERSION_DU_SCHEMA}.json`;
export const CHEMIN_DE_LA_PAGE = '/adresse-des-actes';
const HOTE = 'https://temoinpublic.fr';

export const GABARIT = `${HOTE}/actes/{collectivite}/{jour}/{nature}-{empreinte}`;
export const EXEMPLE = `${HOTE}/actes/17003/2026-10-15/deliberation-64555826dbb9`;

/** Les segments de l'adresse, dans l'ordre : nom, motif, ce qu'il porte, son pendant ELI. */
export const SEGMENTS = [
	{ nom: 'collectivite', motif: MOTIF_COLLECTIVITE, porte: 'Code officiel géographique INSEE de la commune, ou SIREN du groupement (clé de Luhn juste)', eli: 'eli:jurisdiction' },
	{ nom: 'jour', motif: '^\\d{4}-\\d{2}-\\d{2}$', porte: 'Jour UTC de la première datation au registre public', eli: 'eli:date_publication, au plus tard' },
	{ nom: 'nature', motif: `^(?:${Object.keys(NATURES).join('|')})$`, porte: 'Nature de l’acte', eli: 'eli:type_document' },
	{ nom: 'empreinte', motif: `^[0-9a-f]{${HEX_CANONIQUES}}$`, porte: `${HEX_CANONIQUES} premiers caractères hexadécimaux du SHA-256 du document`, eli: 'eli:id_local' }
];

/** Les regles de resolution, dans l'ordre ou le resolveur les applique. */
export const RESOLUTION = [
	{ cas: 'Forme canonique', statut: 200, rend: 'La page de l’acte, ou sa fiche JSON (Accept: application/json)' },
	{ cas: `Préfixe d’empreinte de ${HEX_MINIMUM} à 63 caractères, nature absente ou en capitales, code en minuscules`, statut: 301, rend: 'La forme canonique' },
	{ cas: 'Préfixe partagé par plusieurs actes du même jour et de la même collectivité', statut: 300, rend: `Les adresses canoniques, ${AMBIGUS_MAX} au plus` },
	{ cas: `Segment hors motif, nature inconnue, moins de ${HEX_MINIMUM} caractères, aucun acte`, statut: 404, rend: 'Rien' }
];

/** Les invariants : ce qui ne change jamais pour une adresse donnee. */
export const INVARIANTS = [
	'Une adresse ne change jamais et ne désigne qu’une version.',
	'Une source dont l’empreinte change reçoit une adresse neuve.',
	'Une adresse ne porte aucun nom : code, jour, nature, empreinte.',
	'Le jour est celui de la datation, jamais la date de l’acte.'
];

/** Les champs de la fiche servie a l'adresse en JSON : nom, type JSON, ce qu'il porte. */
export const CHAMPS = [
	['adresse', 'string', 'L’adresse canonique'],
	['schema', 'string', 'L’identifiant de ce schéma'],
	['collectivite', 'string', 'Code INSEE ou SIREN'],
	['jour', 'string', 'Jour de la datation (AAAA-MM-JJ)'],
	['nature', 'string', 'deliberation, arrete ou decision'],
	['sha256', 'string', 'Empreinte SHA-256 du document, 64 caractères'],
	['recu', 'string', 'Identifiant du reçu, 64 caractères'],
	['registre', 'string', 'Registre public du jour de la datation'],
	['place', 'integer', 'Rang de la ligne dans ce registre'],
	['objet', 'string | null', 'Objet de l’acte, null s’il pourrait nommer une personne'],
	['source', 'string | null', 'Adresse lue sur le site officiel, null si elle pourrait nommer une personne'],
	['date_lue', 'object | null', 'Date de l’acte lue dans l’objet ou le nom du fichier : date, precision (jour, mois), dans (libelle, fichier)'],
	['passage', 'object | null', 'État de la source au dernier passage : jour, etat (vue, absente)'],
	['versions', 'array', 'Adresses des versions datées à la même source, de la plus ancienne à la plus récente']
];

/** Ce que l'API porte deja de l'adresse. */
export const API = [
	['GET /api/recus/{recu}', 'acte', 'L’adresse canonique de l’acte que le reçu date'],
	['POST /mcp, outil lire_recu', 'acte', 'La même adresse'],
	['GET /sitemap-actes.xml', 'loc, lastmod', 'Chaque adresse, datée du jour de sa datation']
];

const PROPRIETES_JSON = {
	'string | null': { type: ['string', 'null'] },
	'object | null': { type: ['object', 'null'] },
	array: { type: 'array', items: { type: 'string', format: 'uri' } },
	integer: { type: 'integer', minimum: 1 },
	string: { type: 'string' }
};

/** Le fichier de schema : un JSON Schema de la fiche, la forme et la resolution en extensions `x-`. */
export function schemaDeLAdresse() {
	const proprietes = Object.fromEntries(CHAMPS.map(([nom, type, porte]) => [nom, { ...PROPRIETES_JSON[type], description: porte }]));
	proprietes.adresse.pattern = `/actes/(?:${SEGMENTS[0].motif.replaceAll('^', '').replaceAll('$', '')})/${SEGMENTS[1].motif.slice(1, -1)}/${SEGMENTS[2].motif.slice(1, -1)}-${SEGMENTS[3].motif.slice(1, -1)}$`;
	proprietes.collectivite.pattern = SEGMENTS[0].motif;
	proprietes.jour.pattern = SEGMENTS[1].motif;
	proprietes.nature.enum = Object.keys(NATURES);
	proprietes.sha256.pattern = '^[0-9a-f]{64}$';
	proprietes.recu.pattern = '^[0-9a-f]{64}$';
	proprietes.schema.const = `${HOTE}${CHEMIN_DU_SCHEMA}`;
	return {
		$schema: 'https://json-schema.org/draft/2020-12/schema',
		$id: `${HOTE}${CHEMIN_DU_SCHEMA}`,
		title: 'Adresse pérenne d’un acte local',
		version: String(VERSION_DU_SCHEMA),
		licence: 'https://www.etalab.gouv.fr/licence-ouverte-open-licence/',
		type: 'object',
		required: CHAMPS.map(([nom]) => nom),
		additionalProperties: true,
		properties: proprietes,
		'x-gabarit': GABARIT,
		'x-exemple': EXEMPLE,
		'x-segments': SEGMENTS,
		'x-resolution': RESOLUTION,
		'x-invariants': INVARIANTS,
		'x-api': API.map(([adresse, champ, porte]) => ({ adresse, champ, porte })),
		'x-eli': {
			profil: 'Profil local : juridiction = la collectivité, type = la nature, date = la datation, identifiant naturel = l’empreinte',
			ontologie: 'http://data.europa.eu/eli/ontology#'
		},
		'x-resolveurs': [HOTE]
	};
}

/** La fiche JSON d'un acte a son adresse, conforme au schema ; `acte` arrive garde. */
export function ficheDeLActe({ adresse, acte, versions, passage, date, cheminDe }) {
	return {
		adresse,
		schema: `${HOTE}${CHEMIN_DU_SCHEMA}`,
		collectivite: acte.collectivite,
		jour: acte.jour,
		nature: acte.nature,
		sha256: acte.sha256,
		recu: acte.recu,
		registre: `${HOTE}/depots/${acte.jour}.jsonl`,
		place: acte.place,
		objet: acte.objet,
		source: acte.url,
		date_lue: date,
		passage: passage ? { jour: passage.jour, etat: passage.etat } : null,
		versions: versions.map((v) => `${HOTE}${cheminDe(v)}`)
	};
}
