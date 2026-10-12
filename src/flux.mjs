// Le connecteur de flux (D-170) : lire un flux RSS 2.0 ou Atom 1.0, donner a
// chaque entree une identite et une empreinte, et decider ce qui se lit
// aujourd'hui. Pur : ni reseau, ni base, ni dependance.
//
// Une version d'article est faite des OCTETS que sert sa page, lus par le
// temoin d'URL, jamais d'un texte extrait : un tiers ne saurait pas le
// recalculer. Le flux ne sert qu'a savoir QUAND lire : une entree nouvelle, ou
// dont l'empreinte dans le flux change, se lit le jour meme ; une entree encore
// au flux se relit une fois par semaine, ce qui voit une correction silencieuse
// (un flux sans `updated`) sous sept jours.

import { sha256 } from './chaine.mjs';

/** Au plus tant de lectures par flux et par jour, hors des plafonds des depots exterieurs. */
export const LECTURES_PAR_JOUR = 100;
/** Une entree encore au flux se relit apres tant de jours. */
export const RELECTURE_JOURS = 7;

const ENTITES = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

/** Decode les entites XML d'un texte. */
function decoder(texte) {
	return texte.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (tout, nom) => {
		if (nom[0] !== '#') return ENTITES[nom] ?? tout;
		const code = nom[1] === 'x' || nom[1] === 'X' ? Number.parseInt(nom.slice(2), 16) : Number(nom.slice(1));
		return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : tout;
	});
}

/** Le texte d'un contenu d'element : sections CDATA telles quelles, le reste decode. */
function texteDe(contenu) {
	let sortie = '';
	let i = 0;
	for (;;) {
		const debut = contenu.indexOf('<![CDATA[', i);
		if (debut < 0) return (sortie + decoder(contenu.slice(i))).trim();
		const fin = contenu.indexOf(']]>', debut);
		if (fin < 0) throw new Error('flux : section CDATA non fermee');
		sortie += decoder(contenu.slice(i, debut)) + contenu.slice(debut + 9, fin);
		i = fin + 3;
	}
}

const finDeNom = (c) => c === '>' || c === '/' || c === ' ' || c === '\t' || c === '\n' || c === '\r';

/** L'indice de la prochaine balise ouvrante `<nom`, en sautant CDATA et commentaires ; -1 sinon. */
function ouvrante(xml, nom, depuis) {
	let i = depuis;
	for (;;) {
		const j = xml.indexOf('<', i);
		if (j < 0) return -1;
		if (xml.startsWith('<![CDATA[', j)) i = sauter(xml, j, ']]>');
		else if (xml.startsWith('<!--', j)) i = sauter(xml, j, '-->');
		else if (xml.startsWith(nom, j + 1) && finDeNom(xml[j + 1 + nom.length])) return j;
		else i = j + 1;
	}
}

function sauter(xml, debut, marque) {
	const fin = xml.indexOf(marque, debut);
	if (fin < 0) throw new Error('flux : section non fermee');
	return fin + marque.length;
}

/** Les elements `nom` de `xml`, non imbriques : `{ balise, contenu }`, la balise ouvrante et ce qu'elle enferme. */
function elements(xml, nom) {
	const trouves = [];
	let i = 0;
	for (;;) {
		const debut = ouvrante(xml, nom, i);
		if (debut < 0) return trouves;
		const finBalise = xml.indexOf('>', debut);
		if (finBalise < 0) throw new Error(`flux : balise ${nom} non fermee`);
		const balise = xml.slice(debut, finBalise + 1);
		if (balise.endsWith('/>')) {
			trouves.push({ balise, contenu: '' });
			i = finBalise + 1;
			continue;
		}
		const fin = fermante(xml, nom, finBalise + 1);
		trouves.push({ balise, contenu: xml.slice(finBalise + 1, fin) });
		i = fin + nom.length + 3;
	}
}

/** L'indice de `</nom>` apres `depuis`, en sautant CDATA et commentaires. */
function fermante(xml, nom, depuis) {
	const marque = `</${nom}>`;
	let i = depuis;
	for (;;) {
		const fin = xml.indexOf(marque, i);
		if (fin < 0) throw new Error(`flux : ${nom} non ferme`);
		const cdata = xml.indexOf('<![CDATA[', i);
		const commentaire = xml.indexOf('<!--', i);
		const saut = [cdata, commentaire].filter((k) => k >= 0 && k < fin).sort((a, b) => a - b)[0];
		if (saut === undefined) return fin;
		i = sauter(xml, saut, saut === cdata ? ']]>' : '-->');
	}
}

/** Le texte du premier element `nom`, ou null. */
function champ(xml, nom) {
	const [e] = elements(xml, nom);
	if (!e) return null;
	return texteDe(e.contenu) || null;
}

/** La valeur d'un attribut d'une balise ouvrante, decodee ; null s'il manque. */
function attribut(balise, nom) {
	const m = new RegExp(`\\s${nom}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(balise);
	return m ? decoder(m[1] ?? m[2]) : null;
}

/** Une date de flux en ISO, ou null si elle ne se lit pas. */
function dateIso(texte) {
	const t = Date.parse(texte ?? '');
	return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/** Une adresse http(s) absolue, resolue sur la base du flux ; null sinon. */
function adresse(valeur, base) {
	if (!valeur) return null;
	try {
		const u = new URL(valeur, base);
		return ['http:', 'https:'].includes(u.protocol) ? u.href : null;
	} catch {
		return null;
	}
}

function entreeRss(item, base) {
	const lien = adresse(champ(item, 'link'), base);
	return {
		id: champ(item, 'guid') ?? lien,
		lien,
		titre: champ(item, 'title'),
		resume: champ(item, 'description'),
		contenu: champ(item, 'content:encoded'),
		publie: dateIso(champ(item, 'pubDate')),
		modifie: dateIso(champ(item, 'atom:updated') ?? champ(item, 'dc:date'))
	};
}

function entreeAtom(entry, base) {
	const liens = elements(entry, 'link').map((e) => ({ rel: attribut(e.balise, 'rel') ?? 'alternate', href: attribut(e.balise, 'href') }));
	const lien = adresse(liens.find((l) => l.rel === 'alternate')?.href, base);
	return {
		id: champ(entry, 'id') ?? lien,
		lien,
		titre: champ(entry, 'title'),
		resume: champ(entry, 'summary'),
		contenu: champ(entry, 'content'),
		publie: dateIso(champ(entry, 'published')),
		modifie: dateIso(champ(entry, 'updated'))
	};
}

/**
 * Lit un flux RSS 2.0 ou Atom 1.0. Rend `{ format, titre, entrees, ignorees }` ;
 * une entree sans identite (ni guid, ni id, ni lien) ou deja vue est ignoree et
 * comptee. Leve sur tout autre document : un flux illisible echoue, il ne se devine pas.
 */
export function lireFlux(texte, base) {
	const xml = String(texte ?? '');
	const rss = elements(xml, 'rss')[0];
	const atom = rss ? null : elements(xml, 'feed')[0];
	if (rss && attribut(rss.balise, 'version') !== '2.0') throw new Error('flux : RSS 2.0 seulement');
	if (atom && attribut(atom.balise, 'xmlns') !== 'http://www.w3.org/2005/Atom') throw new Error('flux : Atom 1.0 sans son espace de noms');
	if (!rss && !atom) throw new Error('flux : ni RSS 2.0 ni Atom 1.0');
	const canal = rss ? (elements(rss.contenu, 'channel')[0]?.contenu ?? '') : atom.contenu;
	const nom = rss ? 'item' : 'entry';
	const lire = rss ? entreeRss : entreeAtom;
	const brutes = elements(canal, nom).map((e) => lire(e.contenu, base));
	const vues = new Set();
	const entrees = [];
	for (const e of brutes) {
		if (!e.id || vues.has(e.id)) continue;
		vues.add(e.id);
		entrees.push(e);
	}
	const premiere = ouvrante(canal, nom, 0);
	const titre = champ(premiere < 0 ? canal : canal.slice(0, premiere), 'title');
	return { format: rss ? 'rss' : 'atom', titre, entrees, ignorees: brutes.length - entrees.length };
}

/** L'empreinte d'une entree DANS LE FLUX : elle change quand son titre, son resume, son contenu, son lien ou ses dates changent. */
export const empreinteDEntree = (e) => sha256(JSON.stringify([e.id, e.lien, e.titre, e.resume, e.contenu, e.publie, e.modifie]));

/** L'identifiant public d'un article : l'empreinte de son identite dans le flux, jamais son titre. */
export const idDArticle = (e) => sha256(`article\n${e.id}\n`);

const joursEntre = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

/** Le flux attend le lendemain apres un 403 ou un 429 ; rend le jour de reprise, ou null. */
export function repriseApres(statut, jour) {
	if (statut !== 403 && statut !== 429) return null;
	const d = new Date(`${jour}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + 1);
	return d.toISOString().slice(0, 10);
}

/**
 * Les lectures du jour pour un flux. `entrees` : `{ id, lien, empreinte }` dans
 * l'ordre du flux. `connus` : par id, `{ empreinte, essaye, lu }` - l'empreinte
 * de l'entree a la DERNIERE LECTURE REUSSIE, le jour du dernier essai, le jour
 * de la derniere lecture reussie. Un essai par article et par jour, donc une
 * version par jour au plus. Rend `[{ id, lien, motif }]`, `motif` valant
 * `nouvelle`, `modifiee` ou `relecture` ; les nouvelles et modifiees d'abord,
 * puis les relectures les plus anciennes, `plafond` au plus.
 */
export function planDuJour({ entrees, connus = {}, jour, plafond = LECTURES_PAR_JOUR, repriseLe = null }) {
	if (repriseLe && jour < repriseLe) return [];
	const urgentes = [];
	const relectures = [];
	for (const e of entrees) {
		const connu = connus[e.id];
		if (!e.lien || connu?.essaye === jour) continue;
		if (!connu?.lu) urgentes.push({ id: e.id, lien: e.lien, motif: 'nouvelle' });
		else if (connu.empreinte !== e.empreinte) urgentes.push({ id: e.id, lien: e.lien, motif: 'modifiee' });
		else if (joursEntre(connu.lu, jour) >= RELECTURE_JOURS) relectures.push({ id: e.id, lien: e.lien, motif: 'relecture', lu: connu.lu });
	}
	relectures.sort((a, b) => a.lu.localeCompare(b.lu));
	return [...urgentes, ...relectures.map(({ lu, ...r }) => r)].slice(0, plafond);
}
