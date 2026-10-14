// L'horodatage eIDAS des racines (RFC 3161), relu par la seconde ecriture : les
// vrais fichiers `.racine.tsr` du journal publie, et chaque alteration qui doit se voir.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { AUTORITES_QUALIFIEES, tourHorodate, verifierHorodatage, verifierHorodatages } from '../src/horodatage.mjs';

const DONNEES = path.resolve(import.meta.dirname, '..', 'donnees', 'empreintes');
const horodates = fs
	.readdirSync(DONNEES)
	.filter((f) => f.endsWith('.racine.tsr'))
	.map((f) => f.slice(0, -'.racine.tsr'.length))
	.sort();
const tsrDe = (id) => new Uint8Array(fs.readFileSync(path.join(DONNEES, `${id}.racine.tsr`)));
const racineDe = (id) => JSON.parse(fs.readFileSync(path.join(DONNEES, `${id}.json`), 'utf8')).racine;
const [id] = horodates;

/** Une copie de `octets` ou la premiere suite `avant` devient `apres`. */
function remplacer(octets, avant, apres) {
	const a = Buffer.from(avant);
	const i = Buffer.from(octets).indexOf(a);
	assert.ok(i >= 0, `${avant} absent`);
	const copie = Uint8Array.from(octets);
	copie.set(Buffer.from(apres), i);
	return copie;
}

test('chaque horodatage publie tient sous une autorite epinglee de la liste de confiance', async () => {
	assert.ok(horodates.length >= 1, 'le journal publie porte au moins un horodatage');
	for (const h of horodates) {
		const v = await verifierHorodatage(tsrDe(h), racineDe(h));
		assert.deepEqual(v.raisons, [], h);
		assert.equal(v.autorite, AUTORITES_QUALIFIEES[0].nom);
		assert.match(v.instant, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
		assert.ok(v.instant >= `${h.slice(0, 4)}-${h.slice(4, 6)}-${h.slice(6, 8)}`, 'horodate apres le debut du tour');
	}
});

test("une autre racine, une signature alteree ou aucune autorite epinglee se voient", async () => {
	const tsr = tsrDe(id);
	assert.deepEqual((await verifierHorodatage(tsr, 'f'.repeat(64))).raisons, ["l'empreinte horodatee n'est pas celle de la racine du tour"]);
	const alteree = Uint8Array.from(tsr);
	alteree[alteree.length - 3] ^= 1;
	assert.deepEqual((await verifierHorodatage(alteree, racineDe(id))).raisons, ['la signature ne correspond pas']);
	const v = await verifierHorodatage(tsr, racineDe(id), []);
	assert.deepEqual(v.raisons, ["le signataire n'est pas emis par une autorite qualifiee epinglee"]);
	assert.equal(v.autorite, null);
});

test("un instant reecrit dans le TSTInfo se voit, et hors de la validite du signataire", async () => {
	const tsr = tsrDe(id);
	const genTime = Buffer.from(tsr).toString('latin1').match(/20\d{12}Z/)[0];
	const v = await verifierHorodatage(remplacer(tsr, genTime, `2099${genTime.slice(4)}`), racineDe(id));
	assert.deepEqual(v.raisons, ['le TSTInfo a change depuis la signature', "l'instant est hors de la validite du certificat du signataire"]);
	assert.equal(v.instant.slice(0, 4), '2099');
});

test("un signataire sans usage d'horodatage se voit, et sa signature par l'autorite tombe", async () => {
	const usage = Buffer.from('06082b06010505070308', 'hex');
	const v = await verifierHorodatage(remplacer(tsrDe(id), usage, Buffer.from('06082b06010505070301', 'hex')), racineDe(id));
	assert.ok(v.raisons.includes("le certificat du signataire n'est pas un certificat d'horodatage"), v.raisons.join(' ; '));
	assert.ok(v.raisons.includes("le signataire n'est pas emis par une autorite qualifiee epinglee"));
});

test("un refus de l'autorite, des octets tronques ou etrangers ne passent pas", async () => {
	const refus = await verifierHorodatage(Uint8Array.of(0x30, 0x05, 0x30, 0x03, 0x02, 0x01, 0x02), racineDe(id));
	assert.deepEqual(refus, { ok: false, raisons: ["horodatage refuse par l'autorite (statut 2)"], instant: null, autorite: null });
	for (const octets of [tsrDe(id).subarray(0, 300), Uint8Array.of(1, 2, 3), new Uint8Array()]) {
		assert.deepEqual((await verifierHorodatage(octets, racineDe(id))).raisons, ['horodatage illisible']);
	}
});

test("le tour qui couvre un document : le premier horodate a partir du sien", () => {
	const tours = [{ id: 'a', fichiers: [] }, { id: 'b', fichiers: ['b.racine.tsr'] }, { id: 'c', fichiers: ['c.racine.ots'] }];
	assert.equal(tourHorodate(tours, 'a').id, 'b');
	assert.equal(tourHorodate(tours, 'b').id, 'b');
	assert.equal(tourHorodate(tours, 'c'), null);
	assert.equal(tourHorodate(tours, 'z'), null);
});

test('la liste des tours : chaque horodatage relu contre la racine du tour, les ecarts nommes', async () => {
	const tours = horodates.map((h) => ({ id: h, racine: racineDe(h), fichiers: [`${h}.racine.tsr`] }));
	const lire = async (chemin) => tsrDe(path.basename(chemin, '.racine.tsr'));
	assert.deepEqual(await verifierHorodatages([...tours, { id: 'x', fichiers: [] }], lire), { ok: true, horodates: horodates.length, raisons: [] });
	const faux = await verifierHorodatages([{ ...tours[0], racine: 'f'.repeat(64) }], lire);
	assert.equal(faux.ok, false);
	assert.deepEqual(faux.raisons, [`${id} : l'empreinte horodatee n'est pas celle de la racine du tour`]);
});
