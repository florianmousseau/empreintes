// La verification du journal des empreintes, ecrite une seconde fois et a part
// de l'entrepot qui le produit : un verificateur qui reprendrait le code du
// producteur ne prouverait rien. Memes formules, memes octets, aucune
// dependance ; le meme fichier tourne dans le navigateur et sous Node.

/** La racine « precedente » du tout premier tour. */
export const RACINE_NULLE = '0'.repeat(64);

const encodeur = new TextEncoder();

/** Le sha256 hexadecimal d'octets ou d'un texte. */
export async function sha256(donnees) {
	const octets = typeof donnees === 'string' ? encodeur.encode(donnees) : donnees;
	const empreinte = await globalThis.crypto.subtle.digest('SHA-256', octets);
	return hex(new Uint8Array(empreinte));
}

const hex = (octets) => Array.from(octets, (o) => o.toString(16).padStart(2, '0')).join('');

function octetsDe(h) {
	const octets = new Uint8Array(h.length / 2);
	for (let i = 0; i < octets.length; i++) octets[i] = parseInt(h.slice(2 * i, 2 * i + 2), 16);
	return octets;
}

/** Le hache de deux noeuds de l'arbre, gauche puis droite, en octets. */
export async function paire(gauche, droite) {
	const a = octetsDe(gauche);
	const b = octetsDe(droite);
	const lies = new Uint8Array(a.length + b.length);
	lies.set(a);
	lies.set(b, a.length);
	return sha256(lies);
}

/** L'empreinte d'une feuille : la cle liee a son contenu et a son jour. */
export const empreinteDeFeuille = (f) => sha256(`${f.cle}\n${f.sha256}\n${f.jour ?? ''}\n`);

/** La racine de Merkle d'une liste d'empreintes ; un niveau impair duplique sa derniere. */
export async function arbre(empreintes) {
	if (empreintes.length === 0) return RACINE_NULLE;
	let niveau = empreintes;
	while (niveau.length > 1) {
		const suivant = [];
		for (let i = 0; i < niveau.length; i += 2) suivant.push(paire(niveau[i], niveau[i + 1] ?? niveau[i]));
		niveau = await Promise.all(suivant);
	}
	return niveau[0];
}

/** Les freres a hacher d'une feuille jusqu'a l'arbre, du bas vers le haut, avec leur cote. */
export async function cheminDAudit(empreintes, index) {
	if (index < 0 || index >= empreintes.length) throw new Error(`feuille ${index} hors de l'arbre`);
	const chemin = [];
	let niveau = empreintes;
	let i = index;
	while (niveau.length > 1) {
		chemin.push(i % 2 === 0 ? { cote: 'droite', empreinte: niveau[i + 1] ?? niveau[i] } : { cote: 'gauche', empreinte: niveau[i - 1] });
		const suivant = [];
		for (let k = 0; k < niveau.length; k += 2) suivant.push(paire(niveau[k], niveau[k + 1] ?? niveau[k]));
		niveau = await Promise.all(suivant);
		i = Math.floor(i / 2);
	}
	return chemin;
}

/** L'arbre que rendent une feuille et son chemin d'audit. */
export async function racineDepuisChemin(empreinte, chemin) {
	let h = empreinte;
	for (const pas of chemin) h = pas.cote === 'droite' ? await paire(h, pas.empreinte) : await paire(pas.empreinte, h);
	return h;
}

/** La racine chainee d'un tour : son arbre lie a son identifiant et a la racine precedente. */
export const chainer = ({ id, precedente, arbre: a }) => sha256(`entrepot\n${id}\n${precedente}\n${a}\n`);

/** Recalcule un releve depuis ses feuilles ; rend les raisons d'un ecart, vide s'il tient. */
export async function verifierReleve(releve) {
	const raisons = [];
	const empreintes = await Promise.all(releve.feuilles.map(empreinteDeFeuille));
	const a = await arbre(empreintes);
	if (a !== releve.arbre) raisons.push(`${releve.id} : l'arbre recalcule ne correspond pas`);
	const r = await chainer({ id: releve.id, precedente: releve.precedente, arbre: releve.arbre });
	if (r !== releve.racine) raisons.push(`${releve.id} : la racine chainee ne correspond pas`);
	return raisons;
}

/**
 * Verifie la chaine de bout en bout : chaque releve recalcule, chaque
 * `precedente` egale a la racine du tour d'avant, le premier sur la racine
 * nulle. `lire(id)` rend un releve ; `racines` est la liste ordonnee des tours.
 */
export async function verifierChaine(ids, lire, { surTour } = {}) {
	const raisons = [];
	let precedente = RACINE_NULLE;
	for (const id of ids) {
		const releve = await lire(id);
		if (releve.id !== id) raisons.push(`${id} : le releve porte l'identifiant ${releve.id}`);
		if (releve.precedente !== precedente) raisons.push(`${id} : la racine precedente n'est pas celle du tour d'avant`);
		raisons.push(...(await verifierReleve(releve)));
		precedente = releve.racine;
		surTour?.(id);
	}
	return { ok: raisons.length === 0, tours: ids.length, derniere: precedente, raisons };
}

/** La place d'un fichier dans un releve : sa feuille, son chemin d'audit, et ce que le chemin rend. */
export async function placeDuFichier(releve, empreinteDuFichier) {
	const index = releve.feuilles.findIndex((f) => f.sha256 === empreinteDuFichier);
	if (index < 0) return null;
	const empreintes = await Promise.all(releve.feuilles.map(empreinteDeFeuille));
	const chemin = await cheminDAudit(empreintes, index);
	const arbreRendu = await racineDepuisChemin(empreintes[index], chemin);
	const racine = await chainer({ id: releve.id, precedente: releve.precedente, arbre: arbreRendu });
	return { feuille: releve.feuilles[index], index, chemin, ok: arbreRendu === releve.arbre && racine === releve.racine };
}
