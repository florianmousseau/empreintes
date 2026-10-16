// Le cahier imprime du journal (D-201, point 2) : chaque trimestre, l'identifiant
// et la racine de chaque tour, mis en pages A5 pour l'impression et le depot
// legal. Pur : les tours entrent, les octets du PDF sortent, rien d'autre ne
// varie (aucune date de fabrication), donc deux constructions du meme
// trimestre rendent le meme fichier. PDF 1.4 ecrit a la main, polices
// standard (Helvetica, Courier) en WinAnsi : aucune dependance.

const A5 = { largeur: 419.53, hauteur: 595.28 };
const MARGE = 22;
const CORPS = 6.8;
const INTERLIGNE = 9.6;
export const LIGNES_PAR_PAGE = 54;

/** Le trimestre d'un identifiant de tour (UTC) : `2026-T4`. */
export const trimestreDe = (id) => `${id.slice(0, 4)}-T${Math.floor((Number(id.slice(4, 6)) - 1) / 3) + 1}`;

/** Les tours d'un trimestre, dans l'ordre. */
export const toursDuTrimestre = (tours, trimestre) => tours.filter((t) => trimestreDe(t.id) === trimestre).sort((a, b) => a.id.localeCompare(b.id));

const instant = (id) => `${id.slice(6, 8)}/${id.slice(4, 6)}/${id.slice(0, 4)} ${id.slice(9, 11)}:${id.slice(11, 13)}:${id.slice(13, 15)}`;
const jour = (id) => instant(id).slice(0, 10);
/** La racine en huit groupes de huit : elle se relit et se recopie a voix haute. */
export const enGroupes = (racine) => racine.match(/.{8}/g).join(' ');

const WINANSI = { '’': 0x92, '‘': 0x91, '“': 0x93, '”': 0x94, '–': 0x96, '—': 0x97, ' ': 0x20 };
/** Une chaine PDF litterale, en octets WinAnsi. */
function chainePdf(texte) {
	const octets = [];
	for (const c of texte) {
		const o = WINANSI[c] ?? c.codePointAt(0);
		if (o > 0xff) throw new Error(`caractere hors WinAnsi : ${c}`);
		if (o === 0x28 || o === 0x29 || o === 0x5c) octets.push(0x5c);
		octets.push(o);
	}
	return `(${String.fromCharCode(...octets)})`;
}

const texte = (police, taille, x, y, t) => `BT /${police} ${taille} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td ${chainePdf(t)} Tj ET`;

function couverture({ numero, trimestre, tours, empreintes, issn }) {
	const [annee, t] = trimestre.split('-T');
	const lignes = [
		['H', 9, `Témoin public, https://temoinpublic.fr`],
		['B', 20, 'Journal des empreintes'],
		['H', 11, `Cahier ${numero}, ${t === '1' ? '1er' : `${t}e`} trimestre ${annee}`],
		...(issn ? [['H', 9, `ISSN ${issn}`]] : []),
		['H', 9, ''],
		['H', 9, `Du ${jour(tours[0].id)} au ${jour(tours.at(-1).id)} : ${tours.length} tours.`],
		['H', 9, ''],
		['H', 8, 'Première racine'],
		['C', CORPS, enGroupes(tours[0].racine)],
		['H', 8, 'Dernière racine'],
		['C', CORPS, enGroupes(tours.at(-1).racine)],
		['H', 9, ''],
		...empreintes.flatMap((e) => [
			['H', 8, e.nom],
			['C', CORPS, enGroupes(e.sha256)]
		]),
		['H', 9, ''],
		['H', 8, 'Chaque racine se vérifie sur https://temoinpublic.fr/verifier'],
		['H', 8, 'et par node scripts/verifier.mjs --chaine (github.com/temoinpublic/empreintes).']
	];
	const flux = [];
	let y = A5.hauteur - 50;
	for (const [p, taille, l] of lignes) {
		y -= taille * 1.8;
		if (l) flux.push(texte(p, taille, MARGE + 10, y, l));
	}
	return flux.join('\n');
}

function pageDeTours({ numero, page, pages, lignes }) {
	const flux = [texte('B', 8, MARGE, A5.hauteur - 36, 'Tour (UTC)'), texte('B', 8, MARGE + 86, A5.hauteur - 36, 'Racine')];
	lignes.forEach((t, i) => {
		const y = A5.hauteur - 52 - i * INTERLIGNE;
		flux.push(texte('C', CORPS, MARGE, y, `${instant(t.id)}  ${enGroupes(t.racine)}`));
	});
	flux.push(texte('H', 7, MARGE, 20, `Journal des empreintes, cahier ${numero}, page ${page} sur ${pages}`));
	return flux.join('\n');
}

/**
 * Le PDF d'un cahier : la couverture, puis les tours du trimestre, un par
 * ligne. `empreintes` liste ce qui identifie le signataire (certificat ES256,
 * cle SLH-DSA), `{ nom, sha256 }`. Rend les octets.
 */
export function cahierPdf({ numero, trimestre, tours, empreintes = [], issn = null }) {
	if (!tours.length) throw new Error(`aucun tour au trimestre ${trimestre}`);
	const paquets = [];
	for (let i = 0; i < tours.length; i += LIGNES_PAR_PAGE) paquets.push(tours.slice(i, i + LIGNES_PAR_PAGE));
	const pages = paquets.length + 1;
	const contenus = [couverture({ numero, trimestre, tours, empreintes, issn }), ...paquets.map((lignes, i) => pageDeTours({ numero, page: i + 2, pages, lignes }))];
	// 1 catalogue, 2 pages, 3-5 polices, puis une page et son flux par feuille.
	const objets = ['<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Count ${pages} /Kids [${contenus.map((_, i) => `${6 + 2 * i} 0 R`).join(' ')}] >>`];
	for (const base of ['Helvetica', 'Helvetica-Bold', 'Courier']) objets.push(`<< /Type /Font /Subtype /Type1 /BaseFont /${base} /Encoding /WinAnsiEncoding >>`);
	contenus.forEach((c, i) => {
		objets.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A5.largeur} ${A5.hauteur}] /Resources << /Font << /H 3 0 R /B 4 0 R /C 5 0 R >> >> /Contents ${7 + 2 * i} 0 R >>`);
		objets.push(`<< /Length ${c.length} >>\nstream\n${c}\nendstream`);
	});
	let pdf = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
	const positions = objets.map((o, i) => {
		const p = pdf.length;
		pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
		return p;
	});
	const xref = pdf.length;
	pdf += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n${positions.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('')}`;
	pdf += `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
	return Uint8Array.from(pdf, (c) => c.charCodeAt(0));
}
