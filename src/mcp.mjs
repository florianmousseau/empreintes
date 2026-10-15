// Le serveur MCP (Model Context Protocol, transport HTTP sans etat) : un agent
// date une page ou une empreinte, lit un recu, cherche les dates d'une
// empreinte. Pur : le service arrive en argument, la Function le branche.

export const VERSIONS_MCP = ['2025-06-18', '2025-03-26', '2024-11-05'];
const ADRESSE = 'https://temoinpublic.fr';
const LIBELLE = { type: 'string', maxLength: 200, description: 'Un nom pour s’y retrouver ; il reste dans le reçu, jamais publié.' };
const SHA256 = { type: 'string', pattern: '^[0-9a-fA-F]{64}$', description: 'Empreinte SHA-256, 64 caractères hexadécimaux.' };

export const OUTILS = [
	{
		name: 'dater_url',
		title: 'Dater une page ou un document en ligne',
		description:
			'Le service lit lui-même l’adresse publique (http ou https, 20 Mo et 30 s au plus) et inscrit l’empreinte SHA-256 des octets lus dans le registre public, ancré dans Bitcoin. Rend le reçu : à remettre à l’utilisateur, il prouve que ce contenu était servi à cette adresse à cet instant. Une même adresse se lit une fois par jour.',
		inputSchema: { type: 'object', properties: { url: { type: 'string', description: 'Adresse publique à lire.' }, libelle: LIBELLE }, required: ['url'], additionalProperties: false }
	},
	{
		name: 'dater_empreinte',
		title: 'Dater un document par son empreinte',
		description:
			'Inscrit dans le registre public l’empreinte SHA-256 d’un document que l’utilisateur garde ; le document n’est jamais envoyé. Rend le reçu, qui prouve que ce document existait à cette date, sans modification.',
		inputSchema: { type: 'object', properties: { sha256: SHA256, libelle: LIBELLE }, required: ['sha256'], additionalProperties: false }
	},
	{
		name: 'chercher_empreinte',
		title: 'Trouver les dates d’un document',
		description: 'Rend chaque dépôt de cette empreinte SHA-256 : jour, ligne du registre, adresse du reçu. Aucun dépôt : le document n’a pas été daté par ce service.',
		inputSchema: { type: 'object', properties: { sha256: SHA256 }, required: ['sha256'], additionalProperties: false },
		annotations: { readOnlyHint: true }
	},
	{
		name: 'lire_recu',
		title: 'Lire un reçu',
		description: 'Rend la ligne publique d’un reçu par son identifiant (64 caractères hexadécimaux) : empreinte, jour, ligne du registre, et pour un acte de collectivité son adresse pérenne, à citer.',
		inputSchema: { type: 'object', properties: { id: { type: 'string', pattern: '^[0-9a-f]{64}$' } }, required: ['id'], additionalProperties: false },
		annotations: { readOnlyHint: true }
	}
];

const SERVEUR = { name: 'temoinpublic', title: 'Témoin public', version: '1.0.0', websiteUrl: ADRESSE };
const CONSIGNES =
	'Témoin public prouve qu’un document existait à une date, sans modification. Pour prouver ce qu’une page web disait aujourd’hui : dater_url. Donnez toujours à l’utilisateur l’adresse du reçu et le reçu complet : c’est sa preuve. Vérification humaine : https://temoinpublic.fr/verifier';

const resultat = (id, result) => ({ jsonrpc: '2.0', id, result });
const erreur = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
const contenu = (objet, isError = false) => ({ content: [{ type: 'text', text: JSON.stringify(objet, null, 1) }], structuredContent: objet, isError });
const adresseDuRecu = (id) => `${ADRESSE}/recu/${id}`;

/** La reponse d'un depot du service, pour un agent : le recu et son adresse, ou le refus. */
function depotPourAgent(r) {
	const corps = JSON.parse(r.corps);
	if (r.statut !== 201) return contenu({ statut: r.statut, ...corps }, true);
	return contenu({ jour: corps.jour, ligne: corps.place, adresse: adresseDuRecu(corps.id), id: corps.id, recu: corps.recu, verifier: `${ADRESSE}/verifier` });
}

async function appeler(nom, args, service) {
	const a = args ?? {};
	if (nom === 'dater_url') return depotPourAgent(await service.deposer({ url: a.url, libelle: a.libelle }));
	if (nom === 'dater_empreinte') return depotPourAgent(await service.deposer({ sha256: a.sha256, libelle: a.libelle }));
	if (nom === 'chercher_empreinte') {
		const lignes = await service.lignesDeLEmpreinte(String(a.sha256 ?? '').toLowerCase());
		if (lignes === null) return contenu({ erreur: 'sha256 : 64 caractères hexadécimaux' }, true);
		return contenu({ depots: lignes.map((l) => ({ jour: l.jour, ligne: l.place, adresse: adresseDuRecu(l.recu) })) });
	}
	const ligne = await service.ligneDuRecu(a.id);
	return ligne ? contenu({ jour: ligne.jour, ligne: ligne.place, sha256: ligne.sha256, adresse: adresseDuRecu(ligne.recu), ...(ligne.acte ? { acte: ligne.acte } : {}) }) : contenu({ erreur: 'reçu inconnu' }, true);
}

/**
 * Traite un message JSON-RPC. Rend la reponse, ou null pour une notification.
 * `service` : `deposer(corps)`, `lignesDeLEmpreinte(sha256)`, `ligneDuRecu(id)`.
 */
export async function traiterMessage(message, service) {
	if (!message || typeof message !== 'object' || Array.isArray(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string')
		return erreur(message?.id ?? null, -32600, 'requete invalide');
	const { id, method, params } = message;
	if (id === undefined) return null;
	if (method === 'initialize') {
		const demandee = params?.protocolVersion;
		return resultat(id, { protocolVersion: VERSIONS_MCP.includes(demandee) ? demandee : VERSIONS_MCP[0], capabilities: { tools: {} }, serverInfo: SERVEUR, instructions: CONSIGNES });
	}
	if (method === 'ping') return resultat(id, {});
	if (method === 'tools/list') return resultat(id, { tools: OUTILS });
	if (method === 'tools/call') {
		if (!OUTILS.some((o) => o.name === params?.name)) return erreur(id, -32602, `outil inconnu : ${params?.name}`);
		return resultat(id, await appeler(params.name, params.arguments, service));
	}
	return erreur(id, -32601, `methode inconnue : ${method}`);
}
