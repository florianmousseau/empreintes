// La signature post-quantique des racines (D-201) : SLH-DSA-SHA2-128s relue sans
// dependance, contre des signatures produites par OpenSSL (Node 24) et figees.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { TAILLE_CLE, TAILLE_SIGNATURE, cleBrute, cleSlhDuTour, sha256Sync, toursSansSignatureSlh, verifierSignatureSlhDuJournal, verifierSignaturesSlh, verifierSlhDsa } from '../src/slh.mjs';
import { FICHIER_PUBLIE, verdict } from '../src/journal.mjs';
import { signatureSlhDu } from '../scripts/verifier.mjs';

const F = JSON.parse(readFileSync(new URL('./fixtures/slh/signatures.json', import.meta.url), 'utf8'));
const octets = (hex) => Uint8Array.from(Buffer.from(hex, 'hex'));
const CLE = octets(F.cle);
const SPKI = octets(F.spki);
const SIGNATURES = F.signatures.map((b) => Uint8Array.from(Buffer.from(b, 'base64')));
const message = (racine) => new TextEncoder().encode(racine);
const empreinte = (o) => crypto.createHash('sha256').update(o).digest('hex');
const EPINGLE = [{ empreinte: empreinte(CLE), fichier: 'cle-slh-dsa.pub', depuis: '20261101T000000Z', retire: null }];

test('le SHA-256 synchrone egale celui de Node, autour de chaque bord de bloc', () => {
	for (const n of [0, 1, 55, 56, 63, 64, 65, 119, 120, 1000]) {
		const o = crypto.randomBytes(n);
		assert.equal(Buffer.from(sha256Sync(o)).toString('hex'), empreinte(o), `${n} octets`);
	}
});

test('une signature OpenSSL figee se verifie, sous la cle brute comme sous SubjectPublicKeyInfo', () => {
	assert.equal(TAILLE_SIGNATURE, 7856);
	assert.equal(TAILLE_CLE, 32);
	F.racines.forEach((r, i) => {
		assert.ok(verifierSlhDsa(message(r), SIGNATURES[i], CLE), r);
		assert.ok(verifierSlhDsa(message(r), SIGNATURES[i], SPKI), r);
	});
});

test('un octet altere ou qu il soit, une autre cle, un autre message : refuse', () => {
	const [r] = F.racines;
	// R, FORS, puis une position dans chacune des sept couches de l'hyperarbre.
	for (const pos of [0, 20, 1500, 2928, 3400, 4200, 5000, 5700, 6500, 7855]) {
		const s = SIGNATURES[0].slice();
		s[pos] ^= 1;
		assert.equal(verifierSlhDsa(message(r), s, CLE), false, `octet ${pos}`);
	}
	assert.equal(verifierSlhDsa(message(r), SIGNATURES[0], octets(F.autreCle)), false);
	assert.equal(verifierSlhDsa(message(F.racines[1]), SIGNATURES[0], CLE), false);
	assert.equal(verifierSlhDsa(message(r), SIGNATURES[0].slice(1), CLE), false);
	assert.equal(verifierSlhDsa(message(r), null, CLE), false);
	assert.equal(verifierSlhDsa(message(r), SIGNATURES[0], CLE.slice(1)), false);
});

test('une cle se lit brute ou en SubjectPublicKeyInfo de SLH-DSA-SHA2-128s, jamais d un autre algorithme', () => {
	assert.deepEqual(cleBrute(SPKI), CLE);
	assert.equal(cleBrute(CLE), CLE);
	const autre = SPKI.slice();
	autre[14] = 0x15;
	assert.equal(cleBrute(autre), null);
	assert.equal(cleBrute(undefined), null);
});

test('une signature fraiche de Node se verifie, quand Node sait signer SLH-DSA', { skip: !safe(() => crypto.generateKeyPairSync('slh-dsa-sha2-128s')) }, () => {
	const { publicKey, privateKey } = crypto.generateKeyPairSync('slh-dsa-sha2-128s');
	const spki = publicKey.export({ format: 'der', type: 'spki' });
	const m = Buffer.from(crypto.randomBytes(32).toString('hex'));
	assert.ok(verifierSlhDsa(m, crypto.sign(null, m, privateKey), spki));
});

function safe(f) {
	try {
		return f();
	} catch {
		return null;
	}
}

test('la cle qui couvre un tour : la derniere a partir de son depuis, refusee des son retrait', () => {
	const cles = [...EPINGLE, { empreinte: 'b'.repeat(64), fichier: 'cle-slh-dsa-2.pub', depuis: '20270101T000000Z', retire: '20270601T000000Z' }];
	assert.equal(cleSlhDuTour('20261015T000000Z', cles), null);
	assert.equal(cleSlhDuTour('20261201T000000Z', cles).fichier, 'cle-slh-dsa.pub');
	assert.equal(cleSlhDuTour('20270201T000000Z', cles).fichier, 'cle-slh-dsa-2.pub');
	assert.equal(cleSlhDuTour('20270601T000000Z', cles), null);
	assert.equal(cleSlhDuTour('20261201T000000Z').fichier, 'cle-slh-dsa.pub', 'la cle du journal couvre les tours d apres sa premiere signature');
	assert.equal(cleSlhDuTour('20261016T101644Z'), null, 'un tour d avant la premiere signature n est pas couvert');
	assert.equal(cleSlhDuTour('20261201T000000Z', []), null, 'aucune cle epinglee, rien n est exige');
});

test('la signature d un tour dit pourquoi elle est refusee', () => {
	const [r] = F.racines;
	const e = empreinte(CLE);
	assert.deepEqual(verifierSignatureSlhDuJournal(SIGNATURES[0], r, CLE, e), { ok: true, raisons: [] });
	assert.deepEqual(verifierSignatureSlhDuJournal(SIGNATURES[0], r, octets(F.autreCle), e).raisons, ["la cle n'est pas celle du journal"]);
	assert.deepEqual(verifierSignatureSlhDuJournal(SIGNATURES[0], r, null, e).raisons, ["la cle n'est pas celle du journal"]);
	assert.deepEqual(verifierSignatureSlhDuJournal(SIGNATURES[0].slice(8), r, CLE, e).raisons, ['pas une signature SLH-DSA-SHA2-128s']);
	assert.deepEqual(verifierSignatureSlhDuJournal(SIGNATURES[1], r, CLE, e).raisons, ['la signature ne correspond pas']);
});

const tour = (id, racine, slh = true) => ({ id, racine, fichiers: [`${id}.json`, `${id}.racine`, ...(slh ? [`${id}.racine.slh`] : [])] });
const FICHIERS = new Map([
	['/empreintes/cle-slh-dsa.pub', CLE],
	['/empreintes/20261102T000000Z.racine.slh', SIGNATURES[0]],
	['/empreintes/20261103T000000Z.racine.slh', SIGNATURES[1]],
	['/empreintes/20261104T000000Z.racine.slh', SIGNATURES[0]]
]);
const lireOctets = async (chemin) => FICHIERS.get(chemin);

test('les signatures de toute la liste : chacune relue, la cle lue une fois, l ecart nomme son tour', async () => {
	const tours = [tour('20261101T000000Z', F.racines[0], false), tour('20261102T000000Z', F.racines[0]), tour('20261103T000000Z', F.racines[1])];
	const lus = [];
	const v = await verifierSignaturesSlh(tours, async (c) => (lus.push(c), lireOctets(c)), EPINGLE);
	assert.deepEqual(v, { ok: true, signees: 2, raisons: [] });
	assert.equal(lus.filter((c) => c.endsWith('.pub')).length, 1);
	const rompue = await verifierSignaturesSlh([...tours, tour('20261104T000000Z', F.racines[1])], lireOctets, EPINGLE);
	assert.deepEqual(rompue.raisons, ['20261104T000000Z : la signature ne correspond pas']);
	const sansCle = await verifierSignaturesSlh(tours, lireOctets, []);
	assert.deepEqual(sansCle.raisons, ['20261102T000000Z : aucune cle post-quantique epinglee ne couvre ce tour', '20261103T000000Z : aucune cle post-quantique epinglee ne couvre ce tour']);
});

test('la sonde passe attention quand un tour couvert par une cle n a pas sa signature', () => {
	const maintenant = new Date('2026-11-03T01:00:00Z');
	const tours = [tour('20261102T000000Z', F.racines[0]), tour('20261103T000000Z', F.racines[1], false)].map((t) => ({ ...t, instant: '2026-11-03T00:00:00Z', ots: 'bitcoin' }));
	assert.deepEqual(toursSansSignatureSlh(tours, EPINGLE).map((t) => t.id), ['20261103T000000Z']);
	assert.deepEqual(verdict(tours, maintenant, null, EPINGLE), { alerte: 'attention', constats: ['1 tour(s) sans signature post-quantique, dernier 20261103T000000Z'] });
	assert.equal(verdict(tours, maintenant, null, []).alerte, 'ok', 'rien n est exige avant la premiere cle epinglee');
});

test('la signature et la cle se publient ; rien d autre de ce nom', () => {
	for (const f of ['20261102T000000Z.racine.slh', 'cle-slh-dsa.pub', 'cle-slh-dsa-2.pub']) assert.ok(FICHIER_PUBLIE.test(f), f);
	for (const f of ['cle-slh-dsa.key', 'cle-slh-dsa.pub.bak', '20261102T000000Z.slh']) assert.ok(!FICHIER_PUBLIE.test(f), f);
});

test('le verificateur en ligne de commande relit la signature d un tour sur le site', async () => {
	const serveur = http.createServer((req, res) => {
		const o = FICHIERS.get(req.url);
		return o ? res.writeHead(200).end(o) : res.writeHead(404).end();
	});
	await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
	const site = `http://127.0.0.1:${serveur.address().port}`;
	try {
		assert.equal(await signatureSlhDu(site, tour('20261101T000000Z', F.racines[0], false), F.racines[0], EPINGLE), null);
		assert.deepEqual(await signatureSlhDu(site, tour('20261102T000000Z', F.racines[0]), F.racines[0], EPINGLE), { ok: true, raisons: [] });
		assert.deepEqual((await signatureSlhDu(site, tour('20261102T000000Z', F.racines[0]), F.racines[0], [])).raisons, ['aucune cle post-quantique epinglee ne couvre ce tour']);
	} finally {
		serveur.close();
	}
});
