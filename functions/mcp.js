// POST /mcp : le serveur MCP, transport HTTP sans etat ni session.
import { annuaireDesActifs } from '../src/annuaire.mjs';
import { traiterMessage } from '../src/mcp.mjs';
import { deposer, ligneDuRecu, lignesDeLEmpreinte } from '../src/service.mjs';

const CORS = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'mcp-protocol-version' };
const JSON_UTF8 = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS };

export async function onRequestPost({ request, env }) {
	let message;
	try {
		message = await request.json();
	} catch {
		return new Response(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON illisible' } }), { status: 400, headers: JSON_UTF8 });
	}
	const db = env.DEPOTS;
	const service = {
		deposer: (corps) => deposer({ db, corps, adresse: request.headers.get('cf-connecting-ip'), annuaire: annuaireDesActifs(env, request.url) }),
		lignesDeLEmpreinte: (empreinte) => lignesDeLEmpreinte({ db, empreinte }),
		ligneDuRecu: (id) => ligneDuRecu({ db, id })
	};
	const reponse = await traiterMessage(message, service);
	if (reponse === null) return new Response(null, { status: 202, headers: CORS });
	return new Response(JSON.stringify(reponse), { status: 200, headers: JSON_UTF8 });
}

/** Ni flux SSE ni session : un GET ou un DELETE n'a rien a ouvrir. */
export const onRequestGet = () => new Response(null, { status: 405, headers: { allow: 'POST', ...CORS } });
export const onRequestDelete = onRequestGet;

export const onRequestOptions = () =>
	new Response(null, {
		status: 204,
		headers: { ...CORS, 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'content-type, mcp-protocol-version, accept', 'access-control-max-age': '86400' }
	});
