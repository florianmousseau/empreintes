// La date d'un acte LUE dans son libelle, puis dans le nom de son fichier
// (D-205). Elle se devine et s'affiche comme lue, jamais comme prouvee : le
// fait prouve est le jour de la datation, qui seul entre dans l'adresse. Pur.
//
// Formes lues, jour en tete : « 12 fevrier 2026 », « 1er mars 2026 », « 12 02
// 2026 » (separateurs espace, - _ . /), « 12-02-26 », « 15122025 » ; annee en
// tete : « 2026-02-12 », « 20260212 ». A defaut, le mois seul : « fevrier 2026 ». Refusees :
// une date impossible, avant 2000, apres le jour de la datation, et une annee
// sur deux chiffres a plus de trois ans de lui (« 26-02-17 » serait 2017).

const MOIS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
const NOMS = MOIS.join('|');
const S = '[\\s\\-_./]+';
const AVANT = '(?<![\\p{L}\\d])';
const APRES = '(?![\\p{L}\\d])';

const FORMES = [
	{ motif: new RegExp(`${AVANT}(\\d{1,2})(?:er)?${S}(${NOMS})${S}(\\d{4})${APRES}`, 'giu'), lire: (m) => [m[3], MOIS.indexOf(m[2]) + 1, m[1]] },
	{ motif: new RegExp(`${AVANT}(\\d{4})${S}(\\d{1,2})${S}(\\d{1,2})${APRES}`, 'gu'), lire: (m) => [m[1], m[2], m[3]] },
	{ motif: new RegExp(`${AVANT}(\\d{1,2})${S}(\\d{1,2})${S}(\\d{4}|\\d{2})${APRES}`, 'gu'), lire: (m) => [m[3], m[2], m[1]] },
	{ motif: new RegExp(`${AVANT}(\\d{2})(\\d{2})(20\\d{2})${APRES}`, 'gu'), lire: (m) => [m[3], m[2], m[1]] },
	{ motif: new RegExp(`${AVANT}(20\\d{2})(\\d{2})(\\d{2})${APRES}`, 'gu'), lire: (m) => [m[1], m[2], m[3]] }
];
// Un mois precede d'un jour est une date complete, refusee ou non : il ne se relit pas au mois.
const MOIS_SEUL = new RegExp(`${AVANT}(?<!\\d(?:er)?${S})(${NOMS})${S}(\\d{4})${APRES}`, 'iu');

const ANS_COURTS_MAX = 3;
const deux = (n) => String(n).padStart(2, '0');

/** Le texte sans accents, en minuscules, les sequences d'echappement d'URL decodees. */
function normaliser(texte) {
	let t = String(texte ?? '');
	try {
		t = decodeURIComponent(t);
	} catch {
		// Un % qui n'echappe rien : le texte se lit tel quel.
	}
	return t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** `AAAA-MM-JJ` si la date existe et tient entre 2000 et le jour de la datation, null sinon. */
function jourValide([an, mois, jour], datation) {
	const court = String(an).length === 2;
	const annee = court ? 2000 + Number(an) : Number(an);
	const iso = `${annee}-${deux(mois)}-${deux(jour)}`;
	const d = new Date(`${iso}T00:00:00Z`);
	if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) return null;
	if (annee < 2000 || iso > datation) return null;
	if (court && Number(datation.slice(0, 4)) - annee > ANS_COURTS_MAX) return null;
	return iso;
}

/** La premiere date complete lue dans un texte, ou null. */
function jourDans(texte, datation) {
	const premieres = FORMES.flatMap(({ motif, lire }) => [...texte.matchAll(motif)].map((m) => ({ index: m.index, jour: jourValide(lire(m), datation) }))).filter((c) => c.jour);
	premieres.sort((a, b) => a.index - b.index);
	return premieres[0]?.jour ?? null;
}

/** Le mois lu dans un texte, `AAAA-MM`, ou null. */
function moisDans(texte, datation) {
	const m = MOIS_SEUL.exec(texte);
	if (!m) return null;
	const mois = `${m[2]}-${deux(MOIS.indexOf(m[1]) + 1)}`;
	return m[2] >= '2000' && mois <= datation.slice(0, 7) ? mois : null;
}

/** Le nom du fichier d'une adresse, ou la chaine vide. */
function fichierDe(url) {
	try {
		return new URL(url).pathname.split('/').pop();
	} catch {
		return '';
	}
}

/**
 * La date d'un acte lue dans `objet` puis dans le nom du fichier de `url` :
 * `{ date, precision, dans }`, `date` en `AAAA-MM-JJ` (precision `jour`) ou
 * `AAAA-MM` (precision `mois`), `dans` = `libelle` ou `fichier` ; null quand
 * rien ne se lit. `jour` est le jour de la datation, borne superieure.
 */
export function dateLue({ objet, url, jour }) {
	const textes = [
		['libelle', normaliser(objet)],
		['fichier', normaliser(fichierDe(url))]
	];
	for (const [dans, texte] of textes) {
		const date = jourDans(texte, jour);
		if (date) return { date, precision: 'jour', dans };
	}
	for (const [dans, texte] of textes) {
		const date = moisDans(texte, jour);
		if (date) return { date, precision: 'mois', dans };
	}
	return null;
}
