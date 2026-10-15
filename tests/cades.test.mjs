// La signature CAdES detachee d'un deposant (D-164, REQ-7.5-03). Les fichiers
// de `fixtures/cades/` sont faits par OpenSSL (`openssl cms -sign -binary`, cles
// jetables, jamais versees) : racine P-384, intermediaire RSA, cachet P-256,
// valides du 15/10/2026 au 14/11/2026.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { baseDeTest } from './d1.mjs';
import { estUnCades, estUneSignature, verifierSignatureDuDeposant } from '../src/origine.mjs';
import { estUnRecu, idDuRecu, lireDemande } from '../src/depot.mjs';
import { deposer } from '../src/service.mjs';

const lire = (nom) => fs.readFileSync(new URL(`./fixtures/cades/${nom}`, import.meta.url));
const b64 = (nom) => lire(nom).toString('base64');
const sha = (o) => createHash('sha256').update(o).digest('hex');
const DOC = sha(lire('doc.txt'));
const INSTANT = '2026-10-20T12:00:00.000Z';
const AUTORITES = { [sha(lire('racine.der'))]: { pays: 'FR', nom: 'Racine Essai', usages: ['cachets'] } };
const INTER = { [sha(lire('inter.der'))]: { pays: 'DE', nom: 'Intermediaire Essai', usages: [] } };
const verifier = (nom, { empreinte = DOC, instant = INSTANT, autorites = AUTORITES } = {}) => verifierSignatureDuDeposant(nom.endsWith('.p7s') ? b64(nom) : nom, empreinte, instant, autorites);

test('une signature CAdES detachee sur le document tient, nomme son certificat et remonte a l autorite', async () => {
	const v = await verifier('doc.p7s');
	assert.deepEqual(v.raisons, []);
	assert.equal(v.certificat.sujet, 'Cachet Essai, Commune d Essai');
	assert.equal(v.certificat.emetteur, 'Intermediaire Essai, Essai');
	assert.equal(v.certificat.jusquau, '2026-11-14T03:05:05.000Z');
	assert.equal(v.certificat.autorite, null, 'la racine inscrite n est pas dans le CMS : rien ne la relie');
	assert.deepEqual((await verifier('doc.p7s', { autorites: INTER })).certificat.autorite, { pays: 'DE', nom: 'Intermediaire Essai' });
	const rsa = await verifier('doc-rsa.p7s');
	assert.deepEqual(rsa.raisons, [], 'un signataire RSA, attribut rsaEncryption');
	assert.equal(rsa.certificat.sujet, 'Intermediaire Essai, Essai');
	assert.deepEqual(rsa.certificat.autorite, { pays: 'FR', nom: 'Racine Essai' });
	assert.ok(!('autorite' in (await verifier('doc.p7s', { autorites: null })).certificat));
});

test('chaque ecart se dit : autre document, instant hors validite, octet de signature, contenu joint, SHA-384, CMS illisible', async () => {
	assert.deepEqual((await verifier('doc.p7s', { empreinte: 'b'.repeat(64) })).raisons, ["l'empreinte signee n'est pas celle du document"]);
	assert.deepEqual((await verifier('doc.p7s', { instant: '2027-01-01T00:00:00Z' })).raisons, ["le certificat n'est pas valide a l'instant du depot"]);
	const abime = Buffer.from(lire('doc.p7s'));
	abime[abime.length - 2] ^= 1;
	assert.deepEqual((await verifier(abime.toString('base64'))).raisons, ['la signature ne correspond pas']);
	assert.deepEqual((await verifier('doc-attache.p7s')).raisons, ['signature attachee : seul le document garde le contenu, la signature doit etre detachee']);
	assert.deepEqual((await verifier('doc-sha384.p7s')).raisons, ['condensat SHA-256 attendu']);
	assert.deepEqual((await verifier(Buffer.from('pas un CMS').toString('base64'))).raisons, ['signature CAdES illisible']);
	assert.deepEqual((await verifier(Buffer.from([0x30, 0x03, 0x06, 0x01, 0x2a]).toString('base64'))).raisons, ['signature CAdES illisible']);
});

test('un CMS sans le certificat de son signataire, ou a plusieurs signataires, ne se lit pas', async () => {
	// Le DER de doc.p7s, certificats retires : on reconstruit le SignedData sans son [0].
	const { element, enfants } = await import('../src/horodatage.mjs');
	const der = lire('doc.p7s');
	const [type, enveloppe] = enfants(element(der, 0));
	const champs = enfants(enfants(enveloppe)[0]);
	const tlv = (etiquette, corps) => {
		const n = corps.length;
		const longueur = n < 128 ? [n] : n < 256 ? [0x81, n] : [0x82, n >> 8, n & 255];
		return Buffer.concat([Buffer.from([etiquette, ...longueur]), corps]);
	};
	const cms = (signedData) => tlv(0x30, Buffer.concat([type.entier, tlv(0xa0, tlv(0x30, Buffer.concat(signedData.map((c) => c.entier))))])).toString('base64');
	const sansCertificats = champs.filter((c) => c.etiquette !== 0xa0);
	assert.deepEqual((await verifier(cms(sansCertificats))).raisons, ['certificat du signataire absent']);
	const signataires = champs.at(-1);
	const double = { entier: tlv(0x31, Buffer.concat([...enfants(signataires), ...enfants(signataires)].map((s) => s.entier))) };
	assert.deepEqual((await verifier(cms([...champs.slice(0, -1), double]))).raisons, ['un seul signataire est lu']);
});

test('la forme : base64 sans point pour CAdES, un JWS n en est pas un', () => {
	assert.ok(estUnCades(b64('doc.p7s')));
	assert.ok(!estUnCades('abc'), 'longueur non multiple de 4');
	assert.ok(!estUnCades('a.b.c'));
	assert.ok(estUneSignature(b64('doc.p7s')));
	assert.ok(!estUneSignature('x'));
	assert.deepEqual(lireDemande({ sha256: DOC, signature: b64('doc.p7s') }).demande.signature, b64('doc.p7s'));
});

test('un depot signe en CAdES rend un recu version 4 qui porte la signature en `cades`', async () => {
	const db = baseDeTest();
	const r = await deposer({ db, corps: { sha256: DOC, signature: b64('doc.p7s') }, adresse: 'a', maintenant: new Date(INSTANT), autorites: async () => ({ autorites: INTER }) });
	assert.equal(r.statut, 201);
	const { recu, id } = JSON.parse(r.corps);
	assert.equal(recu.version, 4);
	assert.deepEqual(Object.keys(recu.signature), ['cades', 'certificat', 'sujet', 'emetteur', 'autorite']);
	assert.equal(recu.signature.cades, b64('doc.p7s'));
	assert.deepEqual(recu.signature.autorite, { pays: 'DE', nom: 'Intermediaire Essai' });
	assert.ok(estUnRecu(recu));
	assert.equal(id, await idDuRecu(recu));
	const refuse = await deposer({ db, corps: { sha256: 'c'.repeat(64), signature: b64('doc.p7s') }, adresse: 'a', maintenant: new Date(INSTANT) });
	assert.equal(refuse.statut, 400);
});
