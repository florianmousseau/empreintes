// La signature du deposant (D-164, REQ-7.5-03) : un JWS JAdES sur l'empreinte
// du document, relu sous la cle de son certificat. Les certificats et les cles
// sont fabriques ici, jetables ; le service ne juge pas l'emetteur, donc la
// signature du certificat lui-meme n'a pas a tenir.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { baseDeTest } from './d1.mjs';
import { estUnJws, nomLisible, verifierSignatureDuDeposant } from '../src/origine.mjs';
import { element } from '../src/horodatage.mjs';
import { estUnRecu, idDuRecu, lireDemande } from '../src/depot.mjs';
import { deposer } from '../src/service.mjs';

const { subtle } = globalThis.crypto;
const H = createHash('sha256').update('PV du conseil').digest('hex');
const midi = new Date('2026-10-15T12:00:00Z');
const corpsDe = (r) => JSON.parse(r.corps);

const longueur = (n) => (n < 128 ? [n] : n < 256 ? [0x81, n] : [0x82, n >> 8, n & 255]);
const tlv = (etiquette, ...parties) => {
	const corps = Buffer.concat(parties.map((p) => Buffer.from(p)));
	return Buffer.concat([Buffer.from([etiquette, ...longueur(corps.length)]), corps]);
};
const seq = (...p) => tlv(0x30, ...p);
const oid = (h) => tlv(0x06, Buffer.from(h, 'hex'));
const attribut = (o, valeur, etiquette = 0x0c) => tlv(0x31, seq(oid(o), tlv(etiquette, valeur)));
const nom = ({ cn, o }) => seq(...[o && attribut('55040a', Buffer.from(o)), cn && attribut('550403', Buffer.from(cn))].filter(Boolean));
const temps = (d) => tlv(0x18, Buffer.from(`${d.toISOString().replace(/[-:T]/g, '').slice(0, 14)}Z`));
const ECDSA_SHA256 = seq(oid('2a8648ce3d040302'));

/** Un certificat X.509 minimal : version 3, sujet, emetteur, validite, cle, QcCompliance au besoin. */
function certificatDe({ spki, sujet, emetteur, debut = new Date('2026-01-01'), fin = new Date('2027-01-01'), qc = true }) {
	const qcStatements = seq(seq(oid('2b06010505070103'), tlv(0x04, seq(seq(oid('04008e460101'))))));
	const tbs = seq(tlv(0xa0, tlv(0x02, [2])), tlv(0x02, [7]), ECDSA_SHA256, nom(emetteur), seq(temps(debut), temps(fin)), nom(sujet), spki, ...(qc ? [tlv(0xa3, qcStatements)] : []));
	return seq(tbs, ECDSA_SHA256, tlv(0x03, [0, 1, 2, 3]));
}

const ALGOS = {
	ES256: { generer: { name: 'ECDSA', namedCurve: 'P-256' }, signer: { name: 'ECDSA', hash: 'SHA-256' } },
	ES384: { generer: { name: 'ECDSA', namedCurve: 'P-384' }, signer: { name: 'ECDSA', hash: 'SHA-384' } },
	RS256: { generer: { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, signer: { name: 'RSASSA-PKCS1-v1_5' } },
	PS256: { generer: { name: 'RSA-PSS', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, signer: { name: 'RSA-PSS', saltLength: 32 } }
};
const cles = {};
async function signataire(alg, certificat = {}) {
	cles[alg] ??= await subtle.generateKey(ALGOS[alg].generer, true, ['sign', 'verify']);
	const spki = Buffer.from(await subtle.exportKey('spki', cles[alg].publicKey));
	const der = certificatDe({ spki, sujet: { cn: 'Cachet de la mairie', o: 'Commune de Cravans' }, emetteur: { cn: 'Autorite de test', o: 'Test' }, ...certificat });
	return { cle: cles[alg].privateKey, der };
}

const b64u = (b) => Buffer.from(b).toString('base64url');
/** Un JWS compact du deposant ; `charge` est l'empreinte, jointe sauf `detachee`. */
async function jwsDe({ alg = 'ES256', certificat, entete = {}, charge = H, detachee = false } = {}) {
	const { cle, der } = await signataire(alg, certificat);
	const h = b64u(JSON.stringify({ alg, x5c: [der.toString('base64')], ...entete }));
	const p = b64u(charge);
	const s = await subtle.sign(ALGOS[alg].signer, cle, Buffer.from(`${h}.${p}`));
	return { jws: `${h}.${detachee ? '' : p}.${b64u(s)}`, der };
}

test('une signature ES256, ES384, RS256 ou PS256 sur l empreinte tient, et nomme son certificat', async () => {
	for (const alg of Object.keys(ALGOS)) {
		const { jws, der } = await jwsDe({ alg });
		const v = await verifierSignatureDuDeposant(jws, H, midi.toISOString());
		assert.deepEqual(v.raisons, [], alg);
		assert.deepEqual(v.certificat, {
			empreinte: createHash('sha256').update(der).digest('hex'),
			sujet: 'Cachet de la mairie, Commune de Cravans',
			emetteur: 'Autorite de test, Test',
			jusquau: '2027-01-01T00:00:00.000Z',
			qcCompliance: true
		});
	}
});

test('la charge peut etre detachee, et x5t#S256 comme sigT critique sont compris', async () => {
	const { jws } = await jwsDe({ detachee: true });
	assert.match(jws, /^[^.]+\.\.[^.]+$/);
	assert.ok((await verifierSignatureDuDeposant(jws, H, midi.toISOString())).ok);
	const { der } = await signataire('ES256');
	const x5t = createHash('sha256').update(der).digest('base64url');
	const { jws: complet } = await jwsDe({ entete: { 'x5t#S256': x5t, sigT: '2026-10-15T11:59:00Z', crit: ['sigT'] } });
	assert.ok((await verifierSignatureDuDeposant(complet, H, midi.toISOString())).ok);
	const { jws: sansQc } = await jwsDe({ certificat: { qc: false } });
	assert.equal((await verifierSignatureDuDeposant(sansQc, H, midi.toISOString())).certificat.qcCompliance, false);
});

test('chaque ecart se dit : autre document, octet de signature, algorithme, en-tete critique, x5t, validite', async () => {
	const raisons = async (jws, empreinte = H, instant = midi.toISOString()) => (await verifierSignatureDuDeposant(jws, empreinte, instant)).raisons;
	const { jws } = await jwsDe();
	assert.deepEqual(await raisons(jws, 'b'.repeat(64)), ["la charge utile n'est pas l'empreinte du document"]);
	const [h, p, s] = jws.split('.');
	const octets = Buffer.from(s, 'base64url');
	octets[3] ^= 1;
	assert.deepEqual(await raisons(`${h}.${p}.${octets.toString('base64url')}`), ['la signature ne correspond pas']);
	assert.deepEqual(await raisons((await jwsDe({ detachee: true })).jws, 'b'.repeat(64)), ['la signature ne correspond pas']);
	const entete = JSON.parse(Buffer.from(h, 'base64url'));
	const avec = (modif) => `${b64u(JSON.stringify({ ...entete, ...modif }))}.${p}.${s}`;
	assert.ok((await raisons(avec({ alg: 'HS256' }))).includes('algorithme HS256 non admis'));
	assert.deepEqual(await raisons(avec({ alg: 'ES384' })), ['la signature ne correspond pas'], 'une cle P-256 ne se lit pas en P-384');
	assert.ok((await raisons(avec({ crit: ['b64'], b64: false }))).includes('en-tete critique non compris'));
	assert.ok((await raisons(avec({ crit: ['sigT'] }))).includes('en-tete critique non compris'), 'sigT declare critique mais absent');
	assert.ok((await raisons(avec({ crit: 'sigT' }))).includes('en-tete critique non compris'));
	assert.ok((await raisons(avec({ 'x5t#S256': 'AAAA' }))).includes('x5t#S256 ne designe pas le certificat'));
	assert.ok((await raisons(jws, H, '2027-03-01T00:00:00Z')).includes("le certificat n'est pas valide a l'instant du depot"));
	assert.ok((await raisons(jws, H, '2025-12-31T23:59:59Z')).includes("le certificat n'est pas valide a l'instant du depot"));
});

test('ce qui ne se lit pas est refuse sans lever', async () => {
	const raisons = async (jws, empreinte = H) => (await verifierSignatureDuDeposant(jws, empreinte, midi.toISOString())).raisons;
	const { jws } = await jwsDe();
	const [, p, s] = jws.split('.');
	assert.deepEqual(await raisons('pas.un'), ['pas un JWS compact']);
	assert.deepEqual(await raisons(42), ['pas un JWS compact']);
	assert.deepEqual(await raisons(jws, 'court'), ['empreinte illisible']);
	assert.deepEqual(await raisons(`${b64u('{')}.${p}.${s}`), ['en-tete illisible']);
	assert.deepEqual(await raisons(`${b64u(JSON.stringify({ alg: 'ES256' }))}.${p}.${s}`), ['certificat absent (x5c)']);
	assert.deepEqual(await raisons(`${b64u(JSON.stringify({ alg: 'ES256', x5c: ['MIIB'] }))}.${p}.${s}`), ['certificat illisible']);
	assert.ok(estUnJws(jws));
	assert.ok(!estUnJws(`${jws}.x`));
	assert.ok(!estUnJws('a'.repeat(32769)));
});

test('le nom lisible prend le nom commun et l organisation, en UTF-8 ou en BMPString, sans doublon', () => {
	const lire = (der) => nomLisible(element(der, 0));
	const bmp = Buffer.from('Mairie', 'utf16le').swap16();
	assert.equal(lire(seq(attribut('550403', bmp, 0x1e))), 'Mairie');
	assert.equal(lire(seq(attribut('550403', Buffer.from('Cravans')), attribut('55040a', Buffer.from('Cravans')))), 'Cravans');
	assert.equal(lire(seq(attribut('550406', Buffer.from('FR'), 0x13))), null);
});

test('un depot signe rend un recu version 4 ; une signature fausse est refusee sans rien inscrire', async () => {
	const db = baseDeTest();
	const { jws } = await jwsDe();
	assert.deepEqual(lireDemande({ sha256: H, signature: 'x' }).erreurs, ['signature : un JWS compact (JAdES), 32 768 caracteres au plus']);
	const ok = await deposer({ db, corps: { sha256: H, signature: jws }, adresse: '203.0.113.1', maintenant: midi });
	assert.equal(ok.statut, 201);
	const { recu, id, ligne } = corpsDe(ok);
	assert.equal(recu.version, 4);
	assert.deepEqual(Object.keys(recu.signature), ['jws', 'certificat', 'sujet', 'emetteur']);
	assert.equal(recu.signature.jws, jws);
	assert.equal(recu.signature.sujet, 'Cachet de la mairie, Commune de Cravans');
	assert.ok(estUnRecu(recu));
	assert.equal(id, await idDuRecu(recu));
	assert.deepEqual(Object.keys(JSON.parse(ligne)), ['sha256', 'jour', 'place', 'recu'], 'la ligne publique ne change pas');
	const faux = await deposer({ db, corps: { sha256: 'b'.repeat(64), signature: jws }, adresse: '203.0.113.1', maintenant: midi });
	assert.equal(faux.statut, 400);
	assert.deepEqual(corpsDe(faux), { erreur: 'signature refusee', details: ["la charge utile n'est pas l'empreinte du document"] });
	assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM depot').get().n, 1);
	assert.equal(db.sqlite.prepare('SELECT n FROM compte').get().n, 1, 'un refus ne compte pas dans le plafond');
});

test('avec le temoin, une signature refusee rend la lecture du jour : la bonne passe ensuite', async () => {
	const db = baseDeTest();
	const temoin = async (admise) => ({ url: admise.url, taille: 13, type: 'application/pdf', lu: midi.toISOString(), sha256: H });
	const { jws: autre } = await jwsDe({ charge: 'c'.repeat(64) });
	const refuse = await deposer({ db, corps: { url: 'https://cravans.fr/pv.pdf', signature: autre }, adresse: 'a', maintenant: midi, temoin });
	assert.equal(refuse.statut, 400);
	assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM lecture').get().n, 0);
	const { jws } = await jwsDe();
	const accepte = await deposer({ db, corps: { url: 'https://cravans.fr/pv.pdf', signature: jws }, adresse: 'a', maintenant: midi, temoin });
	assert.equal(accepte.statut, 201);
	assert.equal(corpsDe(accepte).recu.version, 4);
	assert.equal(corpsDe(accepte).recu.temoin.url, 'https://cravans.fr/pv.pdf');
});
