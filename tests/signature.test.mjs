// La signature du journal (D-164) relue par la seconde ecriture : les vrais
// fichiers `.racine.jws` du journal publie, et chaque alteration qui doit se voir.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CERTIFICAT_DU_JOURNAL, clePubliqueDuCertificat, verifierSignatureDuJournal, verifierSignatures } from '../src/chaine.mjs';

const DONNEES = path.resolve(import.meta.dirname, '..', 'donnees', 'empreintes');
const signes = fs
	.readdirSync(DONNEES)
	.filter((f) => f.endsWith('.racine.jws'))
	.map((f) => f.slice(0, -'.racine.jws'.length))
	.sort();
const jwsDe = (id) => fs.readFileSync(path.join(DONNEES, `${id}.racine.jws`), 'utf8');
const racineDe = (id) => fs.readFileSync(path.join(DONNEES, `${id}.racine`), 'utf8').trim();
const [id] = signes;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const entete = (jws) => JSON.parse(Buffer.from(jws.split('.')[0], 'base64url').toString('utf8'));

test('chaque signature du journal publiee tient sous le certificat epingle', async () => {
	assert.ok(signes.length >= 1, 'le journal publie porte au moins une signature');
	for (const s of signes) {
		const v = await verifierSignatureDuJournal(jwsDe(s), racineDe(s));
		assert.deepEqual(v.raisons, [], s);
		assert.match(v.sigT, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
	}
});

test("une autre racine, une signature alteree ou un autre certificat epingle se voient", async () => {
	const jws = jwsDe(id);
	assert.deepEqual((await verifierSignatureDuJournal(jws, 'f'.repeat(64))).raisons, ["la charge utile n'est pas la racine du tour"]);
	const [h, p, s] = jws.trim().split('.');
	const octets = Buffer.from(s, 'base64url');
	octets[5] ^= 1;
	assert.deepEqual((await verifierSignatureDuJournal(`${h}.${p}.${octets.toString('base64url')}`, racineDe(id))).raisons, ['la signature ne correspond pas']);
	assert.deepEqual((await verifierSignatureDuJournal(jws, racineDe(id), '0'.repeat(64))).raisons, ["le certificat n'est pas celui du journal"]);
	assert.equal(CERTIFICAT_DU_JOURNAL.length, 64);
});

test("un en-tete substitue se voit : algorithme, sigT hors de crit, x5t d'un autre certificat, certificat tronque", async () => {
	const jws = jwsDe(id).trim();
	const [, p, s] = jws.split('.');
	const e = entete(jws);
	const avec = (modif) => `${b64({ ...e, ...modif })}.${p}.${s}`;
	const r1 = (await verifierSignatureDuJournal(avec({ alg: 'ES384' }), racineDe(id))).raisons;
	assert.ok(r1.includes('algorithme ES384') && r1.includes('la signature ne correspond pas'));
	assert.ok((await verifierSignatureDuJournal(avec({ crit: [] }), racineDe(id))).raisons.includes('sigT absent ou mal declare'));
	assert.ok((await verifierSignatureDuJournal(avec({ 'x5t#S256': 'AAAA' }), racineDe(id))).raisons.includes('x5t#S256 ne designe pas le certificat'));
	const tronque = (await verifierSignatureDuJournal(avec({ x5c: [e.x5c[0].slice(0, 40)] }), racineDe(id))).raisons;
	assert.ok(tronque.includes("le certificat n'est pas celui du journal") && tronque.includes('la signature ne correspond pas'));
});

test("ce qui n'est pas un JWS ne se lit pas", async () => {
	assert.deepEqual(await verifierSignatureDuJournal('a.b', racineDe(id)), { ok: false, raisons: ['pas un JWS compact'], sigT: null });
	assert.deepEqual(await verifierSignatureDuJournal('%%%.b.c', racineDe(id)), { ok: false, raisons: ['en-tete illisible'], sigT: null });
	assert.throws(() => clePubliqueDuCertificat(new Uint8Array([0x30, 0x82, 0xff])), /DER tronque/);
});

test('la liste des tours : chaque signature relue contre la racine du tour, les ecarts nommes', async () => {
	const tours = signes.map((s) => ({ id: s, racine: racineDe(s), fichiers: [`${s}.racine`, `${s}.racine.jws`] }));
	const lireTexte = async (chemin) => fs.readFileSync(path.join(DONNEES, path.basename(chemin)), 'utf8');
	assert.deepEqual(await verifierSignatures([...tours, { id: 'x', racine: 'r', fichiers: [] }, { id: 'y', racine: 'r' }], lireTexte), { ok: true, signees: signes.length, raisons: [] });
	const faux = await verifierSignatures([{ ...tours[0], racine: 'f'.repeat(64) }], lireTexte);
	assert.equal(faux.ok, false);
	assert.deepEqual(faux.raisons, [`${id} : la charge utile n'est pas la racine du tour`]);
});
