// Les gardes du temoin d'URL : le service lit lui-meme une adresse publique et
// depose l'empreinte des octets recus. Tout ce qui decide est ici, pur et
// teste sans reseau ; la Function ne fait que brancher `fetch` et le DoH.

import { sha256 } from './chaine.mjs';

/** L'agent nomme qui lit pour le deposant. */
export const AGENT = 'empreintes-temoin (+https://empreintes.florianmousseau.com)';
export const SAUTS_MAX = 5;
export const OCTETS_MAX = 20 * 1024 * 1024;
export const DELAI_MS = 30 * 1000;

/** Les plages IPv4 qu'un temoin ne lit jamais : privees, locales, lien-local et metadonnees, reservees. */
const PLAGES_V4 = [
	['0.0.0.0', 8],
	['10.0.0.0', 8],
	['100.64.0.0', 10],
	['127.0.0.0', 8],
	['169.254.0.0', 16],
	['172.16.0.0', 12],
	['192.0.0.0', 24],
	['192.0.2.0', 24],
	['192.88.99.0', 24],
	['192.168.0.0', 16],
	['198.18.0.0', 15],
	['198.51.100.0', 24],
	['203.0.113.0', 24],
	['224.0.0.0', 4],
	['240.0.0.0', 4]
];

const NOMS_INTERDITS = /(^|\.)(localhost|local|internal|intranet|lan|home\.arpa|localdomain)$/i;

function entierV4(ip) {
	const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
	if (!m) return null;
	const octets = m.slice(1).map(Number);
	if (octets.some((o) => o > 255)) return null;
	return octets.reduce((n, o) => n * 256 + o, 0);
}

function v4Interdite(ip) {
	const n = entierV4(ip);
	return PLAGES_V4.some(([base, bits]) => Math.floor(n / 2 ** (32 - bits)) === Math.floor(entierV4(base) / 2 ** (32 - bits)));
}

/** Une IPv6 en huit groupes de 16 bits, ou null. Accepte `::`, et un IPv4 en queue. */
export function groupesV6(ip) {
	let texte = ip.replace(/^\[|\]$/g, '').toLowerCase();
	if (texte.includes('%')) return null;
	const v4 = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(texte);
	if (v4) {
		const n = entierV4(v4[1]);
		if (n === null) return null;
		texte = `${texte.slice(0, -v4[1].length)}${Math.floor(n / 65536).toString(16)}:${(n % 65536).toString(16)}`;
	}
	const moities = texte.split('::');
	if (moities.length > 2) return null;
	const lire = (s) => (s ? s.split(':') : []);
	const tete = lire(moities[0]);
	const queue = moities.length === 2 ? lire(moities[1]) : [];
	const manque = 8 - tete.length - queue.length;
	if ((moities.length === 1 && manque !== 0) || manque < 0) return null;
	const groupes = [...tete, ...Array(moities.length === 2 ? manque : 0).fill('0'), ...queue];
	if (groupes.length !== 8 || groupes.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
	return groupes.map((g) => parseInt(g, 16));
}

function v6Interdite(g) {
	const zeros = (n) => g.slice(0, n).every((x) => x === 0);
	if (zeros(8) || (zeros(7) && g[7] === 1)) return true;
	const v4Dans = (a, b) => v4Interdite(`${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`);
	if (zeros(5) && g[5] === 0xffff) return v4Dans(g[6], g[7]);
	if (zeros(6)) return true;
	if (g[0] === 0x64 && g[1] === 0xff9b) return v4Dans(g[6], g[7]);
	if ((g[0] & 0xfe00) === 0xfc00 || (g[0] & 0xffc0) === 0xfe80 || (g[0] & 0xff00) === 0xff00) return true;
	if (g[0] === 0x2001 && g[1] === 0x0db8) return true;
	if (g[0] === 0x2002) return v4Dans(g[1], g[2]);
	return false;
}

/** Vrai si l'adresse IP ne doit jamais etre lue ; une adresse illisible l'est aussi. */
export function ipInterdite(ip) {
	if (entierV4(ip) !== null) return v4Interdite(ip);
	const g = groupesV6(ip);
	return g === null ? true : v6Interdite(g);
}

/** Vrai si le texte est une adresse IP litterale (v4, ou v6 entre crochets ou non). */
export const estUneIp = (hote) => entierV4(hote) !== null || (hote.includes(':') && groupesV6(hote) !== null);

/**
 * L'URL qu'un temoin accepte de lire : http ou https, ports par defaut, sans
 * identifiants, hote nomme publiquement ou IP publique. Rend `{ url }` ou `{ refus }`.
 */
export function urlAdmise(texte) {
	let u;
	try {
		u = new URL(texte);
	} catch {
		return { refus: 'url illisible' };
	}
	if (u.protocol !== 'http:' && u.protocol !== 'https:') return { refus: 'http ou https seulement' };
	if (u.username || u.password) return { refus: 'pas d identifiants dans l url' };
	if (u.port !== '') return { refus: 'port par defaut seulement' };
	const hote = u.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '');
	if (estUneIp(hote)) return ipInterdite(hote) ? { refus: 'adresse privee, locale ou reservee' } : { url: u.href, hote };
	if (!hote.includes('.') || NOMS_INTERDITS.test(hote)) return { refus: 'nom d hote non public' };
	u.hash = '';
	return { url: u.href, hote };
}

/** Les IP d'une reponse DoH au format JSON (types A et AAAA). */
export const ipsDoH = (reponse) => (reponse?.Answer ?? []).filter((a) => a.type === 1 || a.type === 28).map((a) => a.data);

/** Le verdict sur la resolution d'un hote : refuse si elle est vide ou si une seule adresse est interdite. */
export function resolutionAdmise(ips) {
	if (ips.length === 0) return { refus: 'hote sans adresse' };
	const interdite = ips.find(ipInterdite);
	return interdite ? { refus: `hote resolu en adresse privee, locale ou reservee (${interdite})` } : { ok: true };
}

/** L'URL du saut suivant d'une redirection, re-gardee ; ou le refus. */
export function sautSuivant({ courante, statut, location, sauts }) {
	if (![301, 302, 303, 307, 308].includes(statut)) return { refus: `statut ${statut} sans redirection` };
	if (sauts >= SAUTS_MAX) return { refus: `plus de ${SAUTS_MAX} redirections` };
	if (!location) return { refus: 'redirection sans location' };
	let suivante;
	try {
		suivante = new URL(location, courante).href;
	} catch {
		return { refus: 'location illisible' };
	}
	return urlAdmise(suivante);
}

/**
 * Lit un flux d'octets dans ses bornes : `OCTETS_MAX` et `DELAI_MS` depuis
 * `debut`. Rend les octets ; leve, en annulant le flux, des qu'une borne casse.
 */
export async function lireBorne(lecteur, { debut, maintenant = () => Date.now(), octetsMax = OCTETS_MAX, delaiMs = DELAI_MS }) {
	const morceaux = [];
	let total = 0;
	for (;;) {
		if (maintenant() - debut > delaiMs) return abandonner(lecteur, `lecture au-dela de ${delaiMs / 1000} s`);
		const { done, value } = await lecteur.read();
		if (done) break;
		total += value.byteLength;
		if (total > octetsMax) return abandonner(lecteur, `document au-dela de ${octetsMax} octets`);
		morceaux.push(value);
	}
	const octets = new Uint8Array(total);
	let i = 0;
	for (const m of morceaux) {
		octets.set(m, i);
		i += m.byteLength;
	}
	return octets;
}

async function abandonner(lecteur, motif) {
	await lecteur.cancel?.(motif);
	throw new Error(motif);
}

/** La cle de la lecture d'une URL un jour (une seule par URL et par jour), sans garder l'URL. */
export const cleDeLecture = (url, jour) => sha256(`temoin\n${jour}\n${url}`);
