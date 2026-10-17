// Les vecteurs de verification SLH-DSA du NIST (ACVP, FIPS 205), jeu
// SLH-DSA-SHA2-128s : interface externe pure avec contexte, et interface
// interne. Chaque cas dit s'il doit passer, et pourquoi il echoue sinon ; la
// source et son commit sont ecrits dans le fichier de vecteurs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifierSlhDsa } from '../src/slh.mjs';

const V = JSON.parse(readFileSync(new URL('./fixtures/slh/acvp-fips205.json', import.meta.url), 'utf8'));
const hex = (h) => Uint8Array.from(Buffer.from(h, 'hex'));
const b64 = (b) => Uint8Array.from(Buffer.from(b, 'base64'));

test('les vecteurs viennent du depot ACVP du NIST, pour SLH-DSA-SHA2-128s seulement', () => {
	assert.equal(V.algorithm, 'SLH-DSA');
	assert.equal(V.mode, 'sigVer');
	assert.equal(V.revision, 'FIPS205');
	assert.match(V.source, /^https:\/\/github\.com\/usnistgov\/ACVP-Server\/blob\/[0-9a-f]{40}\//);
	assert.deepEqual(V.testGroups.map((g) => [g.parameterSet, g.signatureInterface, g.preHash]), [['SLH-DSA-SHA2-128s', 'external', 'pure'], ['SLH-DSA-SHA2-128s', 'internal', 'none']]);
});

for (const groupe of V.testGroups) {
	const interne = groupe.signatureInterface === 'internal';
	test(`interface ${groupe.signatureInterface} : chaque cas rend le verdict attendu par le NIST`, () => {
		const attendus = { true: 0, false: 0 };
		for (const cas of groupe.tests) {
			const contexte = hex(cas.context);
			const verdict = verifierSlhDsa(b64(cas.message), b64(cas.signature), hex(cas.pk), { contexte, interne });
			assert.equal(verdict, cas.testPassed, `tcId ${cas.tcId} : ${cas.reason}`);
			attendus[cas.testPassed] += 1;
		}
		assert.ok(attendus.true >= 2 && attendus.false >= 10, `le jeu porte des cas valides et des cas refuses (${attendus.true} / ${attendus.false})`);
	});
}

test('le contexte compte : un contexte non vide a l exterieur, et le contexte que le NIST a signe', () => {
	const externe = V.testGroups.find((g) => g.signatureInterface === 'external');
	const valide = externe.tests.find((t) => t.testPassed && t.context.length > 0);
	const message = b64(valide.message);
	const signature = b64(valide.signature);
	const pk = hex(valide.pk);
	assert.ok(verifierSlhDsa(message, signature, pk, { contexte: hex(valide.context) }));
	assert.equal(verifierSlhDsa(message, signature, pk), false, 'sans son contexte, la signature ne correspond plus');
	assert.equal(verifierSlhDsa(message, signature, pk, { contexte: hex(valide.context).slice(1) }), false);
	assert.equal(verifierSlhDsa(message, signature, pk, { interne: true }), false, 'l interface interne ne prefixe pas le message');
	assert.equal(verifierSlhDsa(message, signature, pk, { contexte: new Uint8Array(256) }), false, 'un contexte de plus de 255 octets est refuse');
});
