// Les autorites de certification des listes de confiance europeennes, a la
// publication : lit la LOTL puis chaque liste nationale et ecrit
// `dist/confiance/autorites.json`, que le depot signe et `/verifier` lisent pour
// nommer l'autorite d'un certificat. Sous le plancher, rien n'est ecrit : la
// signature reste verifiee, l'emetteur n'est pas juge.
//
//   node scripts/confiance.mjs

import fs from 'node:fs';
import path from 'node:path';
import { PLANCHER_AUTORITES, URL_LOTL, listesNationales, registreDesAutorites } from '../src/confiance.mjs';

const DIST = path.resolve(import.meta.dirname, '..', 'dist');
const lire = async (url) => {
	const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
	if (!r.ok) throw new Error(`${url} repond ${r.status}`);
	return r.text();
};

const listes = listesNationales(await lire(URL_LOTL));
const lectures = await Promise.all(listes.map(async ({ pays, url }) => ({ pays, xml: await lire(url).catch(() => null) })));
const registre = await registreDesAutorites(lectures, new Date().toISOString());
const n = Object.keys(registre.autorites).length;
console.log(`autorites : ${n} certificats, ${listes.length} listes, illisibles : ${registre.illisibles.join(', ') || 'aucune'}`);
if (n < PLANCHER_AUTORITES) {
	console.error(`sous le plancher de ${PLANCHER_AUTORITES} : rien n'est publie`);
	process.exit(1);
}
fs.mkdirSync(path.join(DIST, 'confiance'), { recursive: true });
fs.writeFileSync(path.join(DIST, 'confiance', 'autorites.json'), `${JSON.stringify(registre)}\n`);
