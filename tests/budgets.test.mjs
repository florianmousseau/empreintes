import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync, inflateSync } from 'node:zlib';
import { acteDuLien, coucheTexte, documentBudgetaireDe, estUnTelechargement, estUnePageBudget, pagesBudget, telechargementsDe } from '../src/glane.mjs';

const ICI = 'https://bourgueil.fr/';
const sites = [['bourgueil.fr', '']];
const lien = (href, texte = '') => ({ href: href.startsWith('http') ? href : `${ICI}${href}`, texte });
const doc = (href, texte) => documentBudgetaireDe(lien(href, texte));

test('une page budget ou finances se reconnait a son libelle ou son chemin, pas un budget participatif', () => {
	assert.equal(estUnePageBudget(lien('ma-mairie/budgets/', 'Budgets')), true);
	assert.equal(estUnePageBudget(lien('mairie/finances-communales/', 'Finances')), true);
	assert.equal(estUnePageBudget(lien('x', 'Les comptes administratifs')), true);
	assert.equal(estUnePageBudget(lien('budget-participatif/', 'Budget participatif')), false);
	assert.equal(estUnePageBudget(lien('feux-dartifices-cofinances-par-la-municipalite/', 'Feux')), false, 'cofinances n est pas finances');
	assert.equal(estUnePageBudget(lien('agenda/', 'Agenda')), false);
	const liens = [lien('ma-mairie/budgets/', 'Budgets'), lien('ma-mairie/budgets/', 'Budgets encore'), lien('bp.pdf', 'Budget primitif'), lien('https://ailleurs.fr/budget/', 'Budget'), lien('', 'Accueil budget'), lien('finances/', 'Finances'), lien('budget-annexe/', 'Budget annexe')];
	assert.deepEqual(
		pagesBudget(liens, { sites, ici: ICI }).map((l) => l.href),
		[`${ICI}ma-mairie/budgets/`, `${ICI}finances/`]
	);
	assert.equal(pagesBudget(liens, { sites, ici: ICI, max: 5 }).length, 3);
});

test('un telechargement est un PDF ou un lien de telechargement, meme sans .pdf', () => {
	assert.equal(estUnTelechargement(`${ICI}a/BP-2026.PDF`), true);
	assert.equal(estUnTelechargement('https://www.nazellesnegron.fr/finances/le-budget?download=193:budget-2025'), true);
	assert.equal(estUnTelechargement(`${ICI}telecharger/12`), true);
	assert.equal(estUnTelechargement(`${ICI}?wpdmdl=88`), true);
	assert.equal(estUnTelechargement(`${ICI}budgets/`), false);
	assert.equal(estUnTelechargement(`${ICI}a.pdf.html`), false);
	const liens = [lien('a.pdf', 'A'), lien('a.pdf', 'A bis'), lien('?download=3', 'B'), lien('https://cdn.fr/c.pdf', 'C'), lien('page/', 'D')];
	assert.deepEqual(
		telechargementsDe(liens, sites).map((l) => l.href),
		[`${ICI}a.pdf`, `${ICI}?download=3`]
	);
});

test('le genre, l exercice et le budget se lisent dans le libelle puis le nom du fichier', () => {
	assert.deepEqual(doc('wp-content/uploads/2026/03/BP-2026-COMMUNE.pdf', 'Consulter le budget 2026 de la commune'), {
		url: `${ICI}wp-content/uploads/2026/03/BP-2026-COMMUNE.pdf`,
		genre: 'BP',
		exercice: '2026',
		budget: 'principal',
		libelle: 'Consulter le budget 2026 de la commune'
	});
	assert.equal(doc('x.pdf', 'Commune – compte financier unique 2025').genre, 'CFU');
	assert.equal(doc('2023_CA_commune.pdf', 'Télécharger').genre, 'CA');
	assert.equal(doc('2023_CA_commune.pdf', 'Télécharger').exercice, '2023');
	assert.equal(doc('x.pdf', 'Compte administratif').exercice, null);
	assert.equal(doc('x.pdf', 'Compte administratif').budget, 'inconnu', 'le budget ne se devine pas');
	assert.equal(doc('x.pdf', 'Rapport d’orientation budgétaire 2026').genre, 'ROB');
	assert.equal(doc('x.pdf', 'DOB 2025').genre, 'ROB');
	assert.equal(doc('D2026_039-PJ-Note-synthetique-BUDGET-PRINCIPAL-COMMUNE-2026-tampon.pdf', 'Consulter la note').genre, 'NOTE', 'une note parle du budget, elle n en est pas la maquette');
	assert.equal(doc('02-note-BP.pdf', '').genre, 'NOTE');
	assert.equal(doc('x.pdf', 'Présentation brève et synthétique').genre, 'NOTE');
	assert.equal(doc('x.pdf', 'Golf – budget primitif 2026').budget, 'annexe');
	assert.equal(doc('BP-2026-LOTISSEMENTS.pdf', 'Consulter le budget 2026 “lotissements”').budget, 'annexe');
	assert.equal(doc('le-budget?download=193:budget-2025-depenses-de-fonctionnement', '').genre, 'BP', 'un telechargement sans .pdf se lit a son adresse');
	assert.equal(doc('x.pdf', 'Note brève – Budget prévisionnel 2024').genre, 'NOTE');
	assert.equal(doc('x.pdf', 'Budget prévisionnel 2024').genre, 'BP');
	assert.equal(doc('wp-content/uploads/2020/09/1-_ST_CLEMENT_2026_20260512163058_BP-scelle.pdf', '').exercice, '2026', 'ni le chemin des envois ni un horodatage ne donnent l exercice');
	assert.equal(doc('wp-content/uploads/2020/09/BP.pdf', 'Budget primitif').exercice, null);
	assert.equal(doc('%E9.pdf', 'Compte administratif 2022').exercice, '2022', 'un nom mal encode se lit tel quel');
});

test('sans genre, un sigle seul ou une deliberation, rien n est releve', () => {
	assert.equal(doc('x.pdf', 'Ça bouge à la plage'), null, '« ça » n est pas un compte administratif');
	assert.equal(doc('ca.pdf', 'Bulletin'), null);
	assert.equal(doc('x.pdf', 'Bulletin municipal 2026'), null);
	assert.equal(doc('budgets/', 'Budget primitif 2026'), null, 'une page n est pas un document');
	assert.equal(doc('CM202605_45-delib-votes-BP-2026.pdf', 'Délibération 20260545 Vote du budget primitif 2026'), null, 'la deliberation est un acte');
	assert.equal(doc('D2026_007-PJ-ROB-2026-tampon.pdf', 'Consulter la délibération 026_007 Finances').genre, 'ROB', 'sa piece jointe est le document');
	assert.equal(doc('x.pdf', 'Annexe – compte administratif 2023 (délibération 12)').genre, 'CA');
});

test('le releve budgetaire ne change rien a ce que la glane depose comme acte', () => {
	assert.equal(acteDuLien(lien('budget.pdf', 'Budget primitif 2026')), null);
	assert.deepEqual(acteDuLien(lien('d.pdf', 'Délibération vote du budget primitif 2026')), { url: `${ICI}d.pdf`, nature: 'deliberation', libelle: 'Délibération vote du budget primitif 2026' });
	assert.equal(acteDuLien(lien('d.pdf', 'Délibération budget, M. DUPONT')), null, 'les controles des personnes tiennent');
});

const pdf = (...objets) => Buffer.from(`%PDF-1.7\n${objets.join('\n')}\n%%EOF`, 'latin1');
const flux = (contenu, filtre = '/Filter /FlateDecode') => {
	const octets = filtre ? deflateSync(Buffer.from(contenu, 'latin1')) : Buffer.from(contenu, 'latin1');
	return `1 0 obj << ${filtre} /Length ${octets.length} >>\nstream\n${octets.toString('latin1')}\nendstream\nendobj`;
};

test('la couche texte se lit dans les octets ou dans un flux decompresse', () => {
	const lire = (octets, options = {}) => coucheTexte(octets, { inflate: inflateSync, ...options });
	assert.deepEqual(lire(pdf('2 0 obj << /Type /Font /Subtype /Type1 >> endobj')), { format: 'pdf', couche: 'oui' });
	assert.deepEqual(lire(pdf(flux('<< /Type /ObjStm >> << /Font << /F1 5 0 R >> >>'))), { format: 'pdf', couche: 'oui' }, 'une police cachee dans un flux d objets');
	assert.deepEqual(lire(pdf(flux('BT /F1 12 Tf (Budget) Tj ET', ''))), { format: 'pdf', couche: 'oui' });
	assert.deepEqual(lire(pdf(flux('q 595 0 0 842 0 0 cm /Im0 Do Q'))), { format: 'pdf', couche: 'non' }, 'une page scannee n est qu une image');
	assert.deepEqual(lire(pdf('1 0 obj << /Filter /FlateDecode >>\nstream\npas du zlib\nendstream')), { format: 'pdf', couche: 'non' }, 'un flux illisible est saute');
	assert.deepEqual(lire(pdf('1 0 obj << /Filter /DCTDecode >>\nstream\nxx\nendstream')), { format: 'pdf', couche: 'non' });
	assert.deepEqual(lire(pdf('1 0 obj << >>\nstream\njamais ferme')), { format: 'pdf', couche: 'non' });
	assert.deepEqual(lire(pdf(flux('q Q')), { tronque: true }), { format: 'pdf', couche: 'inconnue' }, 'un fichier tronque sans texte vu ne se juge pas');
	assert.deepEqual(lire(Buffer.from('\x89PNG\r\n', 'latin1')), { format: 'png', couche: 'non' });
	assert.deepEqual(lire(Buffer.from('\xff\xd8\xff', 'latin1')), { format: 'jpeg', couche: 'non' });
	assert.deepEqual(lire(Buffer.from('<!DOCTYPE html><p>404', 'latin1')), { format: 'html', couche: 'non' });
	assert.deepEqual(lire(Buffer.from('PK\x03\x04', 'latin1')), { format: 'zip', couche: 'non' });
	assert.deepEqual(lire(Buffer.from('bonjour', 'latin1')), { format: 'autre', couche: 'non' });
	assert.deepEqual(coucheTexte(pdf('<< /Font >>')), { format: 'pdf', couche: 'oui' }, 'sans inflate fourni, les octets suffisent quand ils parlent');
});
