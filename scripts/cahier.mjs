#!/usr/bin/env node
// Le cahier imprime d'un trimestre du journal (D-201), depuis le journal de ce depot.
//
//   node scripts/cahier.mjs [--trimestre 2026-T4] [--issn 1234-5678] [--sortie <fichier.pdf>]
//
// Sans --trimestre, celui du dernier tour. Sortie par defaut : dist/cahiers/<trimestre>.pdf.

import fs from 'node:fs';
import path from 'node:path';
import { CERTIFICATS_DU_JOURNAL } from '../src/chaine.mjs';
import { CLES_SLH_DU_JOURNAL } from '../src/slh.mjs';
import { cahierPdf, toursDuTrimestre, trimestreDe } from '../src/cahier.mjs';
import { ID_DE_TOUR } from '../src/journal.mjs';

/** Le premier trimestre du journal porte le cahier 1. */
export const PREMIER_TRIMESTRE = '2026-T4';
export const numeroDuCahier = (trimestre) => {
	const rang = (t) => Number(t.slice(0, 4)) * 4 + Number(t.slice(-1));
	return rang(trimestre) - rang(PREMIER_TRIMESTRE) + 1;
};

/** Les tours d'un dossier du journal : chaque `<id>.racine`, lu tel quel. */
export function toursDuDossier(dossier) {
	return fs
		.readdirSync(dossier)
		.filter((f) => f.endsWith('.racine') && ID_DE_TOUR.test(f.slice(0, -7)))
		.map((f) => ({ id: f.slice(0, -7), racine: fs.readFileSync(path.join(dossier, f), 'utf8').trim() }));
}

/** Ce qui identifie le signataire, imprime en couverture. */
export const empreintesDuSignataire = () => [
	...CERTIFICATS_DU_JOURNAL.map((c) => ({ nom: 'Certificat du journal (ES256), sha256', sha256: c.empreinte })),
	...CLES_SLH_DU_JOURNAL.map((c) => ({ nom: 'Clé SLH-DSA-SHA2-128s (FIPS 205), sha256', sha256: c.empreinte }))
];

function principal(args) {
	const opt = (nom) => (args.includes(nom) ? args[args.indexOf(nom) + 1] : null);
	const tours = toursDuDossier(path.join(import.meta.dirname, '..', 'donnees', 'empreintes'));
	const trimestre = opt('--trimestre') ?? trimestreDe(tours.map((t) => t.id).sort().at(-1));
	const sortie = opt('--sortie') ?? path.join(import.meta.dirname, '..', 'dist', 'cahiers', `${trimestre}.pdf`);
	const du = toursDuTrimestre(tours, trimestre);
	const pdf = cahierPdf({ numero: numeroDuCahier(trimestre), trimestre, tours: du, empreintes: empreintesDuSignataire(), issn: opt('--issn') });
	fs.mkdirSync(path.dirname(sortie), { recursive: true });
	fs.writeFileSync(sortie, pdf);
	console.log(`${sortie} : cahier ${numeroDuCahier(trimestre)}, ${du.length} tours, ${pdf.length} octets`);
}

if (process.argv[1] === import.meta.filename) principal(process.argv.slice(2));
