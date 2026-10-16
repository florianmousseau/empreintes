// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Florian Mousseau. Ce fichier seul est sous licence MIT
// (LICENSES/MIT.txt) pour que tout logiciel, ouvert ou ferme, puisse verifier.
// La verification d'une signature SLH-DSA-SHA2-128s (FIPS 205, aout 2024), sans
// dependance et synchrone : WebCrypto ne connait pas SLH-DSA, et une
// verification demande quelques milliers de SHA-256. Le meme fichier tourne
// dans le navigateur et sous Node. Version « pure », contexte vide : celle que
// rend `crypto.sign(null, message, cle)` de Node 24.

const N = 16;
const H = 63;
const D = 7;
const H_PRIME = H / D;
const A = 12;
const K = 14;
const LG_W = 4;
const W = 1 << LG_W;
const LEN1 = (8 * N) / LG_W;
const LEN2 = 3;
const LEN = LEN1 + LEN2;
const TAILLE_FORS = K * (A + 1) * N;
const TAILLE_XMSS = (LEN + H_PRIME) * N;

/** La taille d'une signature SLH-DSA-SHA2-128s, en octets. */
export const TAILLE_SIGNATURE = N + TAILLE_FORS + D * TAILLE_XMSS;
/** La taille d'une cle publique brute (PK.seed puis PK.root), en octets. */
export const TAILLE_CLE = 2 * N;
/** L'en-tete DER d'une cle publique SLH-DSA-SHA2-128s en SubjectPublicKeyInfo (OID 2.16.840.1.101.3.4.3.20). */
const ENTETE_SPKI = Uint8Array.from([0x30, 0x30, 0x30, 0x0b, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x03, 0x14, 0x03, 0x21, 0x00]);

const WOTS_HASH = 0;
const WOTS_PK = 1;
const TREE = 2;
const FORS_TREE = 3;
const FORS_ROOTS = 4;

const K256 = Uint32Array.from([
	0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);
const ETAT_INITIAL = Uint32Array.from([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
const rotr = (x, n) => (x >>> n) | (x << (32 - n));

/** Le SHA-256 d'octets, synchrone. */
export function sha256Sync(octets) {
	const bits = octets.length * 8;
	const total = Math.ceil((octets.length + 9) / 64) * 64;
	const bloc = new Uint8Array(total);
	bloc.set(octets);
	bloc[octets.length] = 0x80;
	const vue = new DataView(bloc.buffer);
	vue.setUint32(total - 8, Math.floor(bits / 2 ** 32));
	vue.setUint32(total - 4, bits >>> 0);
	const h = ETAT_INITIAL.slice();
	const w = new Uint32Array(64);
	for (let p = 0; p < total; p += 64) {
		for (let i = 0; i < 16; i++) w[i] = vue.getUint32(p + 4 * i);
		for (let i = 16; i < 64; i++) {
			const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
			const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
			w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
		}
		let [a, b, c, d, e, f, g, k] = h;
		for (let i = 0; i < 64; i++) {
			const t1 = (k + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K256[i] + w[i]) >>> 0;
			const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
			[k, g, f, e, d, c, b, a] = [g, f, e, (d + t1) >>> 0, c, b, a, (t1 + t2) >>> 0];
		}
		[a, b, c, d, e, f, g, k].forEach((x, i) => (h[i] = (h[i] + x) >>> 0));
	}
	const sortie = new Uint8Array(32);
	const vs = new DataView(sortie.buffer);
	h.forEach((x, i) => vs.setUint32(4 * i, x));
	return sortie;
}

function concat(...morceaux) {
	const sortie = new Uint8Array(morceaux.reduce((n, m) => n + m.length, 0));
	let p = 0;
	for (const m of morceaux) {
		sortie.set(m, p);
		p += m.length;
	}
	return sortie;
}

/** Une adresse ADRS (FIPS 205, 4.2), tenue sous sa forme compressee de 22 octets (11.2). */
class Adresse {
	octets = new Uint8Array(22);
	vue = new DataView(this.octets.buffer);
	copie() {
		const a = new Adresse();
		a.octets.set(this.octets);
		return a;
	}
	couche(x) {
		this.octets[0] = x;
	}
	arbre(x) {
		this.vue.setBigUint64(1, x);
	}
	typeEtEfface(y) {
		this.octets[9] = y;
		this.octets.fill(0, 10);
	}
	paire(x) {
		this.vue.setUint32(10, x);
	}
	get lePaire() {
		return this.vue.getUint32(10);
	}
	chaine(x) {
		this.vue.setUint32(14, x);
	}
	hauteur(x) {
		this.vue.setUint32(14, x);
	}
	indice(x) {
		this.vue.setUint32(18, x);
	}
	get lIndice() {
		return this.vue.getUint32(18);
	}
}

const ZEROS = new Uint8Array(64 - N);
/** F, H et T_l du jeu SHA2 en categorie 1 : une seule formule (FIPS 205, 11.2.1). */
const hache = (graine, adresse, ...m) => sha256Sync(concat(graine, ZEROS, adresse.octets, ...m)).slice(0, N);

function mgf1(graine, longueur) {
	const blocs = [];
	for (let c = 0; blocs.length * 32 < longueur; c++) blocs.push(sha256Sync(concat(graine, Uint8Array.of(c >>> 24, (c >>> 16) & 255, (c >>> 8) & 255, c & 255))));
	return concat(...blocs).slice(0, longueur);
}

/** base_2b (FIPS 205, algorithme 4). */
function base2b(x, b, n) {
	const sortie = [];
	let i = 0;
	let bits = 0;
	let total = 0;
	for (let o = 0; o < n; o++) {
		while (bits < b) {
			total = ((total << 8) | x[i++]) & 0xffffff;
			bits += 8;
		}
		bits -= b;
		sortie.push((total >>> bits) & ((1 << b) - 1));
	}
	return sortie;
}

const entier = (octets) => octets.reduce((n, o) => (n << 8n) | BigInt(o), 0n);

/** Remonte un arbre de Merkle d'une feuille a sa racine par son chemin d'authentification. */
function remonter(noeud, feuille, chemin, graine, adresse, decalage = 0) {
	adresse.indice(decalage + feuille);
	for (let j = 0; j < chemin.length; j++) {
		adresse.hauteur(j + 1);
		const pair = Math.floor(feuille / 2 ** j) % 2 === 0;
		adresse.indice(pair ? adresse.lIndice / 2 : (adresse.lIndice - 1) / 2);
		noeud = pair ? hache(graine, adresse, noeud, chemin[j]) : hache(graine, adresse, chemin[j], noeud);
	}
	return noeud;
}

const tranches = (octets, debut, nombre) => Array.from({ length: nombre }, (_, i) => octets.subarray(debut + i * N, debut + (i + 1) * N));

/** wots_pkFromSig (algorithme 8). */
function wotsDepuisSignature(sig, message, graine, adresse) {
	const chiffres = base2b(message, LG_W, LEN1);
	const somme = chiffres.reduce((s, c) => s + W - 1 - c, 0) << 4;
	chiffres.push(...base2b(Uint8Array.of(somme >>> 8, somme & 255), LG_W, LEN2));
	const bouts = chiffres.map((c, i) => {
		adresse.chaine(i);
		let x = sig.subarray(i * N, (i + 1) * N);
		for (let j = c; j < W - 1; j++) {
			adresse.indice(j);
			x = hache(graine, adresse, x);
		}
		return x;
	});
	const cle = adresse.copie();
	cle.typeEtEfface(WOTS_PK);
	cle.paire(adresse.lePaire);
	return hache(graine, cle, ...bouts);
}

/** xmss_pkFromSig (algorithme 11). */
function xmssDepuisSignature(feuille, sig, message, graine, adresse) {
	adresse.typeEtEfface(WOTS_HASH);
	adresse.paire(feuille);
	const noeud = wotsDepuisSignature(sig.subarray(0, LEN * N), message, graine, adresse);
	adresse.typeEtEfface(TREE);
	return remonter(noeud, feuille, tranches(sig, LEN * N, H_PRIME), graine, adresse);
}

/** fors_pkFromSig (algorithme 17). */
function forsDepuisSignature(sig, condense, graine, adresse) {
	const racines = base2b(condense, A, K).map((feuille, i) => {
		const debut = i * (A + 1) * N;
		adresse.hauteur(0);
		adresse.indice(i * 2 ** A + feuille);
		const noeud = hache(graine, adresse, sig.subarray(debut, debut + N));
		return remonter(noeud, feuille, tranches(sig, debut + N, A), graine, adresse, i * 2 ** A);
	});
	const cle = adresse.copie();
	cle.typeEtEfface(FORS_ROOTS);
	cle.paire(adresse.lePaire);
	return hache(graine, cle, ...racines);
}

/** Les 32 octets bruts d'une cle publique, depuis sa forme brute ou SubjectPublicKeyInfo ; null sinon. */
export function cleBrute(octets) {
	if (octets?.length === TAILLE_CLE) return octets;
	if (octets?.length === ENTETE_SPKI.length + TAILLE_CLE && ENTETE_SPKI.every((o, i) => octets[i] === o)) return octets.slice(ENTETE_SPKI.length);
	return null;
}

/**
 * Verifie une signature SLH-DSA-SHA2-128s pure, contexte vide (FIPS 205,
 * algorithmes 20 et 24). `message`, `signature` et `cle` sont des octets ; la
 * cle est brute (32 octets) ou en SubjectPublicKeyInfo. Rend un booleen.
 */
export function verifierSlhDsa(message, signature, cle) {
	const pk = cleBrute(cle);
	if (!pk || signature?.length !== TAILLE_SIGNATURE) return false;
	const graine = pk.subarray(0, N);
	const racine = pk.subarray(N);
	const m = concat(Uint8Array.of(0, 0), message);
	const r = signature.subarray(0, N);
	const condense = mgf1(concat(r, graine, sha256Sync(concat(r, graine, racine, m))), 30);
	let arbre = entier(condense.subarray(21, 28)) & ((1n << 54n) - 1n);
	let feuille = Number(entier(condense.subarray(28, 30)) & 0x1ffn);
	const adresse = new Adresse();
	adresse.arbre(arbre);
	adresse.typeEtEfface(FORS_TREE);
	adresse.paire(feuille);
	let noeud = forsDepuisSignature(signature.subarray(N, N + TAILLE_FORS), condense.subarray(0, 21), graine, adresse);
	for (let j = 0; j < D; j++) {
		const ht = new Adresse();
		ht.couche(j);
		ht.arbre(arbre);
		const debut = N + TAILLE_FORS + j * TAILLE_XMSS;
		noeud = xmssDepuisSignature(feuille, signature.subarray(debut, debut + TAILLE_XMSS), noeud, graine, ht);
		feuille = Number(arbre & 0x1ffn);
		arbre >>= 9n;
	}
	return noeud.every((o, i) => o === racine[i]);
}

const hex = (octets) => Array.from(octets, (o) => o.toString(16).padStart(2, '0')).join('');
const encodeur = new TextEncoder();

/**
 * Les cles SLH-DSA du journal, du plus ancienne a la plus recente, epinglees ici
 * par le sha256 de leur fichier publie (`/empreintes/<fichier>`, 32 octets
 * bruts) : comme le certificat ES256, une cle ne prouve l'origine que comparee
 * a une empreinte publiee hors du fichier signe. Une cle signe les tours a
 * partir de `depuis` ; `retire` refuse ses signatures a partir de ce tour.
 * La premiere cle signe depuis le tour 20261016T161252Z (entrepot#82).
 */
export const CLES_SLH_DU_JOURNAL = [{ empreinte: 'c1eccce60b9e07019b60e86f8c65836332a302f5140e09df54e7c762bc989f9c', fichier: 'cle-slh-dsa.pub', depuis: '20261016T161252Z', retire: null }];

/** La cle SLH-DSA qui signe le tour `id`, ou null si aucune ne le couvre. */
export function cleSlhDuTour(id, cles = CLES_SLH_DU_JOURNAL) {
	const c = cles.findLast((x) => x.depuis <= id);
	return c && !(c.retire && c.retire <= id) ? c : null;
}

/**
 * Relit la signature post-quantique d'un tour (`<tour>.racine.slh`, SLH-DSA-SHA2-128s
 * brute, contexte vide) : le message signe est le texte hexadecimal de la racine,
 * et la cle est celle dont le sha256 est epingle. Rend `{ ok, raisons }`.
 */
export function verifierSignatureSlhDuJournal(signature, racine, cle, empreinteCle) {
	const raisons = [];
	if (!cle || hex(sha256Sync(cle)) !== empreinteCle) raisons.push("la cle n'est pas celle du journal");
	else if (signature?.length !== TAILLE_SIGNATURE) raisons.push('pas une signature SLH-DSA-SHA2-128s');
	else if (!verifierSlhDsa(encodeur.encode(racine), signature, cle)) raisons.push('la signature ne correspond pas');
	return { ok: raisons.length === 0, raisons };
}

/**
 * Les signatures post-quantiques de toute la liste des tours (`tours.json`) :
 * chaque tour qui porte un `.racine.slh` le voit relu contre sa racine et la
 * cle epinglee qui le couvre. `lireOctets(chemin)` rend les octets d'un fichier
 * publie. Rend le compte et les raisons d'un ecart.
 */
export async function verifierSignaturesSlh(tours, lireOctets, cles = CLES_SLH_DU_JOURNAL) {
	const raisons = [];
	const lues = new Map();
	let signees = 0;
	for (const t of tours.filter((x) => x.fichiers?.includes(`${x.id}.racine.slh`))) {
		const c = cleSlhDuTour(t.id, cles);
		signees += 1;
		if (!c) {
			raisons.push(`${t.id} : aucune cle post-quantique epinglee ne couvre ce tour`);
			continue;
		}
		if (!lues.has(c.fichier)) lues.set(c.fichier, await lireOctets(`/empreintes/${c.fichier}`));
		const v = verifierSignatureSlhDuJournal(await lireOctets(`/empreintes/${t.id}.racine.slh`), t.racine, lues.get(c.fichier), c.empreinte);
		raisons.push(...v.raisons.map((r) => `${t.id} : ${r}`));
	}
	return { ok: raisons.length === 0, signees, raisons };
}

/** Les tours qu'une cle epinglee couvre et qui ne portent pas leur `.racine.slh`. */
export const toursSansSignatureSlh = (tours, cles = CLES_SLH_DU_JOURNAL) => tours.filter((t) => cleSlhDuTour(t.id, cles) && !t.fichiers?.includes(`${t.id}.racine.slh`));
