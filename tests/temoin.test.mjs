import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { SAUTS_MAX, cleDeLecture, estUneIp, groupesV6, ipInterdite, ipsDoH, lireBorne, resolutionAdmise, sautSuivant, urlAdmise } from '../src/temoin.mjs';

test('les adresses privees, locales, lien-local, metadonnees et reservees sont refusees', () => {
	for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255', '192.0.2.1', '198.18.0.1', '::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', '64:ff9b::a9fe:a9fe', '2001:db8::1', '2002:7f00:1::', '::127.0.0.1', '[::1]', 'fe80::1%eth0', '1.2.3.999', 'pas-une-ip']) {
		assert.equal(ipInterdite(ip), true, ip);
	}
	for (const ip of ['1.1.1.1', '93.184.216.34', '172.32.0.1', '2606:4700:4700::1111', '::ffff:8.8.8.8', '2a01:4f8::1', '64:ff9b::808:808']) assert.equal(ipInterdite(ip), false, ip);
});

test('une IPv6 se lit en huit groupes, ou pas du tout', () => {
	assert.deepEqual(groupesV6('2001:db8::1'), [0x2001, 0xdb8, 0, 0, 0, 0, 0, 1]);
	assert.deepEqual(groupesV6('::ffff:1.2.3.4'), [0, 0, 0, 0, 0, 0xffff, 0x102, 0x304]);
	for (const faux of ['1::2::3', '1:2:3', '1:2:3:4:5:6:7:8:9', 'g::1', '::1.2.3.256', '1:2:3:4:5:6:7::8:9']) assert.equal(groupesV6(faux), null, faux);
	assert.equal(estUneIp('exemple.fr'), false);
	assert.equal(estUneIp('[2001:db8::1]'), true);
});

test('une url se lit en http ou https, port par defaut, sans identifiants, hote public', () => {
	assert.deepEqual(urlAdmise('https://www.data.gouv.fr/fichier.csv#ancre'), { url: 'https://www.data.gouv.fr/fichier.csv', hote: 'www.data.gouv.fr' });
	assert.deepEqual(urlAdmise('http://93.184.216.34/a'), { url: 'http://93.184.216.34/a', hote: '93.184.216.34' });
	const refus = {
		'pas une url': /illisible/,
		'ftp://x.fr/a': /http ou https/,
		'file:///etc/passwd': /http ou https/,
		'https://u:p@x.fr/': /identifiants/,
		'https://x.fr:8443/': /port/,
		'http://127.0.0.1/': /privee/,
		'http://2130706433/': /privee/,
		'http://0x7f.1/': /privee/,
		'http://[::1]/': /privee/,
		'http://[::ffff:169.254.169.254]/': /privee/,
		'http://localhost/': /non public/,
		'http://api.localhost./': /non public/,
		'http://metadata.google.internal/': /non public/,
		'http://imprimante.local/': /non public/,
		'http://intranet/': /non public/
	};
	for (const [url, motif] of Object.entries(refus)) assert.match(urlAdmise(url).refus ?? '', motif, url);
});

test('la resolution DoH est refusee vide ou des qu une adresse est interdite', () => {
	const doh = { Answer: [{ type: 5, data: 'alias.exemple.fr.' }, { type: 1, data: '93.184.216.34' }, { type: 28, data: '2606:4700::1' }] };
	assert.deepEqual(ipsDoH(doh), ['93.184.216.34', '2606:4700::1']);
	assert.deepEqual(ipsDoH({}), []);
	assert.deepEqual(resolutionAdmise(ipsDoH(doh)), { ok: true });
	assert.match(resolutionAdmise([]).refus, /sans adresse/);
	assert.match(resolutionAdmise(['93.184.216.34', '10.0.0.1']).refus, /10\.0\.0\.1/);
});

test('une redirection se suit cinq fois au plus, et chaque saut repasse les gardes', () => {
	const courante = 'https://x.fr/a/b';
	assert.deepEqual(sautSuivant({ courante, statut: 302, location: '../c', sauts: 0 }), { url: 'https://x.fr/c', hote: 'x.fr' });
	assert.match(sautSuivant({ courante, statut: 301, location: 'http://169.254.169.254/latest', sauts: 1 }).refus, /privee/);
	assert.match(sautSuivant({ courante, statut: 307, location: 'https://y.fr', sauts: SAUTS_MAX }).refus, /plus de 5/);
	assert.match(sautSuivant({ courante, statut: 302, location: null, sauts: 0 }).refus, /sans location/);
	assert.match(sautSuivant({ courante, statut: 302, location: 'http://[zz', sauts: 0 }).refus, /illisible/);
	assert.match(sautSuivant({ courante, statut: 200, location: 'https://y.fr', sauts: 0 }).refus, /statut 200/);
});

function lecteurDe(morceaux, { horloge } = {}) {
	let i = 0;
	const lecteur = {
		annule: null,
		async read() {
			horloge?.();
			return i < morceaux.length ? { done: false, value: morceaux[i++] } : { done: true };
		},
		async cancel(motif) {
			lecteur.annule = motif;
		}
	};
	return lecteur;
}

test('la lecture rend les octets recus dans leurs bornes', async () => {
	const octets = await lireBorne(lecteurDe([new Uint8Array([1, 2]), new Uint8Array([3])]), { debut: 0, maintenant: () => 0 });
	assert.deepEqual([...octets], [1, 2, 3]);
});

test('la lecture coupe et annule le flux au-dela de la taille ou du delai', async () => {
	const gros = lecteurDe([new Uint8Array(6), new Uint8Array(6)]);
	await assert.rejects(lireBorne(gros, { debut: 0, maintenant: () => 0, octetsMax: 10 }), /au-dela de 10 octets/);
	assert.match(gros.annule, /10 octets/);
	let t = 0;
	const lent = lecteurDe([new Uint8Array(1), new Uint8Array(1), new Uint8Array(1)], { horloge: () => (t += 20_000) });
	await assert.rejects(lireBorne(lent, { debut: 0, maintenant: () => t }), /au-dela de 30 s/);
	assert.match(lent.annule, /30 s/);
});

test('une lecture par url et par jour, sous une cle qui ne garde pas l url', async () => {
	const c = await cleDeLecture('https://x.fr/a', '2026-10-12');
	assert.equal(c, createHash('sha256').update('temoin\n2026-10-12\nhttps://x.fr/a').digest('hex'));
	assert.notEqual(c, await cleDeLecture('https://x.fr/a', '2026-10-13'));
});
