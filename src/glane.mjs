// La glane des actes des communes (D-178) : sur le site officiel d'une commune,
// trouver la page de ses actes et les PDF qu'elle publie, et dire de chacun sa
// nature et son objet. Pur : ni reseau, ni base ; `scripts/glaner-actes.mjs`
// branche la politesse, `robots.txt` et le depot.
//
// Une nature ne se devine pas : sans indice dans le libelle du lien ou le nom du
// fichier, le PDF n'est pas depose (une page courte vaut mieux qu'une nature
// fausse). Un objet qui nommerait une personne devient « Sans objet ».

import { surSiteOfficiel } from './acte.mjs';
import { nommeUnePersonne } from './personne.mjs';

/** Le nom par lequel un `robots.txt` designe la glane, et l'agent qu'elle annonce. */
export const JETON_ROBOT = 'temoinpublic';
export const AGENT_GLANE = 'temoinpublic-glane (+https://temoinpublic.fr/collectivite)';
export const SANS_OBJET = 'Sans objet';
const OBJET_MAX = 200;
const ROBOTS_REGLES_MAX = 2000;

/** Minuscules, sans accents ni apostrophe typographique : ce que les motifs lisent. */
export const normaliser = (texte) =>
	String(texte)
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[’‘]/g, "'")
		.toLowerCase();

const ENTITES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', eacute: 'é', egrave: 'è', ecirc: 'ê', agrave: 'à', ccedil: 'ç', ocirc: 'ô', ucirc: 'û', icirc: 'î', rsquo: '’' };

/** Le texte d'un fragment HTML : balises retirees, entites courantes rendues, espaces reduits. */
export function texteDuHtml(html) {
	return String(html)
		.replace(/<[^>]*>/g, ' ')
		.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
		.replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)))
		.replace(/&([a-z]+);/gi, (m, nom) => ENTITES[nom.toLowerCase()] ?? m)
		.replace(/\s+/g, ' ')
		.trim();
}

/** Les liens d'une page, `{ href, texte }`, adresses absolues sans ancre ; `title` quand le lien n'a pas de texte. */
export function liensDe(html, base) {
	const liens = [];
	for (const m of String(html).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
		const href = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(m[1]);
		if (!href) continue;
		const brut = texteDuHtml(href[1] ?? href[2]);
		if (!brut || /^(?:#|mailto:|tel:|javascript:)/i.test(brut)) continue;
		let url;
		try {
			url = new URL(brut, base);
		} catch {
			continue;
		}
		if (!/^https?:$/.test(url.protocol)) continue;
		url.hash = '';
		const titre = /\btitle\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(m[1]);
		liens.push({ href: url.href, texte: texteDuHtml(m[2]) || texteDuHtml(titre?.[1] ?? titre?.[2] ?? '') });
	}
	return liens;
}

const cheminDe = (href) => {
	try {
		return decodeURIComponent(new URL(href).pathname);
	} catch {
		return new URL(href).pathname;
	}
};
const estUnPdf = (href) => /\.pdf$/i.test(new URL(href).pathname);

// Une page d'actes, par ordre de preference : celle qui les porte, puis celle du conseil (un saut de plus).
const PAGES = [
	[3, /(deliberation|proces[- ]?verba|publication des actes|actes? administratif|recueil des actes|registre des actes|actes? (?:de la commune|municipaux|reglementaires|publies)|arretes? (?:municipaux|du maire|permanents|temporaires)|\barretes\b)/],
	[2, /(comptes?[- ]rendus?|seances? du conseil|conseils? municipa)/],
	[1, /(vie municipale|\bmairie\b|conseil\b)/]
];
const PAS_UNE_PAGE_D_ACTES = /(prefe[ct]|etat[- ]civil|naissance|mariage|deces|pacs|demarche|recrutement|offre d'emploi|marche public|appel d'offre)/;

/** Le score d'un lien comme page d'actes, 0 quand il n'en est pas une. */
export function scoreDePage({ href, texte }) {
	const lu = normaliser(`${texte} ${cheminDe(href).replace(/[-_/]+/g, ' ')}`);
	if (PAS_UNE_PAGE_D_ACTES.test(lu)) return 0;
	return PAGES.find(([, motif]) => motif.test(lu))?.[0] ?? 0;
}

/**
 * Les pages d'actes candidates d'une page : liens du site officiel, hors PDF et
 * hors de la page elle-meme, du meilleur score au moins bon, `max` au plus.
 * `plancher` ecarte les liens trop generaux (1 : « mairie », « vie municipale »).
 */
export function pagesCandidates(liens, { sites, ici, max = 3, plancher = 2 }) {
	const vues = new Set([ici]);
	return liens
		.filter((l) => surSiteOfficiel(l.href, sites) && !estUnPdf(l.href))
		.map((l) => ({ ...l, score: scoreDePage(l) }))
		.filter((l) => l.score >= plancher && !vues.has(l.href) && vues.add(l.href))
		.sort((a, b) => b.score - a.score)
		.slice(0, max);
}

/** Les PDF d'une page publies sur le site officiel, chacun une fois, dans l'ordre de la page. */
export function pdfsDe(liens, sites) {
	const vus = new Set();
	return liens.filter((l) => estUnPdf(l.href) && surSiteOfficiel(l.href, sites) && !vus.has(l.href) && vus.add(l.href));
}

const NATURES = [
	['arrete', /\barr[e]tes?\b/],
	['decision', /\bdecisions?\b/],
	['deliberation', /(deliberation|deliberations|proces[- ]?verba|\bpv\b|comptes?[- ]rendus?|\bcr\b|seance|conseil municipal|\bcm\b)/]
];
const PAS_UN_ACTE = /(prefe[ct]|convocation|ordre du jour|\bodj\b|bulletin|magazine|journal|menu|cantine|formulaire|tarif|horaire|plaquette|affiche|flyer|guide)/;

function natureDuTexte(texte) {
	const lu = normaliser(texte).replace(/[-_+.]+/g, ' ');
	if (PAS_UN_ACTE.test(lu)) return { exclu: true };
	let premiere = null;
	for (const [nature, motif] of NATURES) {
		const m = motif.exec(lu);
		if (m && (!premiere || m.index < premiere.index)) premiere = { nature, index: m.index };
	}
	return premiere ? { nature: premiere.nature } : {};
}

/** La nature d'un acte lue dans le libelle de son lien, sinon dans le nom de son fichier ; null sans indice ou pour ce qui n'est pas un acte. */
export function natureDe({ href, texte }) {
	const fichier = cheminDe(href).split('/').pop();
	const duLibelle = natureDuTexte(texte);
	const duFichier = natureDuTexte(fichier);
	if (duLibelle.exclu || duFichier.exclu) return null;
	return duLibelle.nature ?? duFichier.nature ?? null;
}

const GENERIQUE = /^(?:telecharger|telecharger le (?:document|fichier|pdf)|ici|cliquez|cliquez ici|lire|lire la suite|voir|consulter|consulter (?:le|la|les)(?: document| fichier| pdf)?|(?:document|fichier|pdf|piece jointe)s?(?: a telecharger| joints?)?|annexes?|lien|en savoir plus|\d+)$/;

const nettoyer = (texte) =>
	texte
		.replace(/\(?\s*(?:pdf|PDF)?\s*[-,]?\s*\d+(?:[.,]\d+)?\s*(?:[kKmM]i?[oObB]|octets)\s*\)?/g, ' ')
		.replace(/\(\s*\d+(?:[.,]\d+)?\s*[kKmM][a-zA-Z]*\s*\)?/g, ' ')
		.replace(/\s*\(\s*pdf\s*\)|\bpdf\b\s*$/gi, ' ')
		.replace(/^\s*t[ée]l[ée]charger\s*(?:le|la)?\s*/i, '')
		.replace(/\s+/g, ' ')
		.trim();

/** L'objet d'un acte : le libelle du lien, sinon le nom du fichier ; « Sans objet » quand l'un ou l'autre nommerait une personne. */
export function objetDe({ href, texte }) {
	let objet = nettoyer(texte);
	if (objet.length < 4 || GENERIQUE.test(normaliser(objet))) {
		objet = cheminDe(href)
			.split('/')
			.pop()
			.replace(/\.pdf$/i, '')
			.replace(/[-_+.]+/g, ' ')
			.replace(/\b[0-9a-f]{12,}\b/gi, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	}
	if (!objet || nommeUnePersonne(objet)) return SANS_OBJET;
	objet = objet.length > OBJET_MAX ? `${objet.slice(0, OBJET_MAX - 1).trimEnd()}.` : objet;
	return objet[0].toUpperCase() + objet.slice(1);
}

// Les sigles et mots qu'une commune ecrit en capitales sans nommer personne.
const CAPITALES_ADMISES = new Set(
	'CCAS CIAS PLU PLUI SCOT ZAC SDIS EPCI RGPD DETR DSIL FPIC TEOM SIVU SIVOM SDEER SPANC CLECT CAF CNAS ONF CDG SNCF EDF GRDF ENEDIS SAUR ACCA AFR ASA ADS DIA DM BP CA CM PV CR AR RD RN VC CU PC DP CDC SEM SPL OPAH DECI TVA HT TTC ADMR EHPAD ALSH RPI ATSEM'.split(' ')
);
// Un acte individuel nomme presque toujours son beneficiaire : delegation, nomination, permission de voirie.
const ACTE_INDIVIDUEL =
	/(delegation|nomination|nommant|recrutement|stagiairisation|titularisation|disponibilite|reintegration|detachement|avancement d'echelon|mise a la retraite|occupation du domaine public|permission de voirie|permis de stationnement|autorisation de voirie|debit de boissons|buvette|concession|alignement individuel|\bp\.\s|\bm\.\s|\bmme\b|\bmlle\b|monsieur|madame)/;

/**
 * Vrai quand un texte d'acte pourrait nommer une personne au-dela de ce que
 * `nommeUnePersonne` reconnait : un acte individuel, ou un mot en capitales dans un
 * texte qui ne l'est pas (« PETIT Catherine »), ou, pour un arrete ou une decision
 * ecrits tout en capitales, un mot en capitales qui n'est pas un sigle connu.
 */
export function pourraitNommer(texte, nature) {
	const lu = normaliser(texte);
	if (ACTE_INDIVIDUEL.test(lu)) return true;
	const lettres = texte.replace(/[^A-Za-zÀ-ÿ]/g, '');
	const toutEnCapitales = lettres.length > 0 && lettres === lettres.toUpperCase();
	if (toutEnCapitales && nature === 'deliberation') return false;
	const capitales = (texte.match(/\b[A-ZÀ-Ý]{3,}\b/g) ?? []).filter((m) => !CAPITALES_ADMISES.has(normaliser(m).toUpperCase()) && !NATURE_EN_CAPITALES.test(normaliser(m)));
	return capitales.length > 0;
}
const NATURE_EN_CAPITALES = /^(?:arretes?|decisions?|deliberations?|proces|verbal|compte|rendu|seance|conseil|municipal|liste|des|du|de|la|le|les|et|en|au|aux|par|pour|sur|date|janv|janvier|fevr|fevrier|mars|avril|mai|juin|juillet|aout|sept|septembre|oct|octobre|nov|novembre|dec|decembre|annexe|budget|primitif|travaux|circulation|stationnement|voirie|rue|route|chemin|place|impasse|allee|avenue|temporaire|permanent|reglementant|portant|interdiction|interdisant|maire|commune|municipale|affichage|visee|teletransmis|reunion|extrait|registre)$/;

/**
 * Ce que la glane deposerait d'un PDF : `{ url, nature, libelle }`, ou null sans
 * nature, et null quand le libelle, l'objet retenu ou le nom du fichier pourrait
 * nommer une personne : l'adresse du fichier est montree sur la page de la commune.
 */
export function acteDuLien(lien) {
	const nature = natureDe(lien);
	if (!nature) return null;
	const libelle = objetDe(lien);
	const fichier = cheminDe(lien.href).split('/').pop().replace(/[-_+.]+/g, ' ');
	if (libelle === SANS_OBJET || nommeUnePersonne(fichier) || [lien.texte, libelle, fichier].some((t) => pourraitNommer(t, nature))) return null;
	return { url: lien.href, nature, libelle };
}

// --- robots.txt (RFC 9309), ecrit comme celui de l'entrepot (src/communes.mjs) ---

/** Les regles qu'un `robots.txt` donne a la glane : groupes qui la nomment, sinon `*`, sinon aucune. */
export function reglesRobots(texte, jeton = JETON_ROBOT) {
	const groupes = [];
	let courant = null;
	let dansLesAgents = false;
	for (const brute of String(texte).split(/\r\n|\r|\n/)) {
		const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(brute.replace(/#.*/, '').trim());
		if (!m) continue;
		const cle = m[1].toLowerCase();
		const valeur = m[2].trim();
		if (cle === 'user-agent') {
			if (!dansLesAgents) {
				courant = { agents: [], regles: [] };
				groupes.push(courant);
			}
			courant.agents.push(valeur.toLowerCase());
			dansLesAgents = true;
		} else {
			dansLesAgents = false;
			if ((cle === 'allow' || cle === 'disallow') && courant && valeur && courant.regles.length < ROBOTS_REGLES_MAX) courant.regles.push({ permis: cle === 'allow', motif: valeur.slice(0, 500) });
		}
	}
	const nous = groupes.filter((g) => g.agents.some((a) => a.split('/')[0].trim() === jeton));
	return (nous.length ? nous : groupes.filter((g) => g.agents.includes('*'))).flatMap((g) => g.regles);
}

function motifEnRegExp(motif) {
	const ancre = motif.endsWith('$');
	const corps = (ancre ? motif.slice(0, -1) : motif).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
	return new RegExp(`^${corps}${ancre ? '$' : ''}`);
}

/** Vrai si les regles permettent l'adresse : la regle la plus longue l'emporte, `Allow` a egalite. */
export function robotsPermet(regles, url) {
	const u = new URL(url);
	const chemin = u.pathname + u.search;
	if (chemin === '/robots.txt') return true;
	let meilleure = null;
	for (const r of regles) {
		if (!motifEnRegExp(r.motif).test(chemin)) continue;
		if (!meilleure || r.motif.length > meilleure.motif.length || (r.motif.length === meilleure.motif.length && r.permis)) meilleure = r;
	}
	return meilleure ? meilleure.permis : true;
}
