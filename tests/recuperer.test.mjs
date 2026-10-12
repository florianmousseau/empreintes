import test from 'node:test';
import assert from 'node:assert/strict';
import { aTelecharger, fichiersDe } from '../scripts/recuperer.mjs';

const reponse = (href, taille) => `<D:response xmlns:lp1="DAV:"><D:href>${href}</D:href><D:propstat><D:prop>${taille === undefined ? '<lp1:resourcetype><D:collection/></lp1:resourcetype>' : `<lp1:getcontentlength>${taille}</lp1:getcontentlength>`}</D:prop></D:propstat></D:response>`;
const xml = `<?xml version="1.0"?><D:multistatus xmlns:D="DAV:">${[
	reponse('/entrepot/journal/empreintes/'),
	reponse('/entrepot/journal/empreintes/20261012T101314Z.json', 354530),
	reponse('/entrepot/journal/empreintes/20261012T101314Z.racine.ots', 770),
	reponse('/entrepot/journal/empreintes/20261012T101314Z.racine.ots.bak', 700),
	reponse('/entrepot/journal/empreintes/ancrages.json', 3574),
	reponse('/entrepot/journal/empreintes/cache/', undefined)
].join('')}</D:multistatus>`;

test('la liste de la Box ne garde que les fichiers du journal, avec leur taille', () => {
	assert.deepEqual(fichiersDe(xml), [
		{ nom: '20261012T101314Z.json', taille: 354530 },
		{ nom: '20261012T101314Z.racine.ots', taille: 770 },
		{ nom: 'ancrages.json', taille: 3574 }
	]);
});

test('on copie ce qui manque ou a grandi, et ancrages.json a chaque fois', () => {
	const locales = { '20261012T101314Z.json': 354530, '20261012T101314Z.racine.ots': 500, 'ancrages.json': 3574 };
	assert.deepEqual(aTelecharger(fichiersDe(xml), (n) => locales[n] ?? null), ['20261012T101314Z.racine.ots', 'ancrages.json']);
	assert.deepEqual(aTelecharger(fichiersDe(xml), () => null).length, 3);
});

test('un releve qui change sur la Box arrete la copie', () => {
	assert.throws(() => aTelecharger([{ nom: '20261012T101314Z.json', taille: 2 }], () => 1), /ne se reecrit jamais/);
});
