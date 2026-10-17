import test from 'node:test';
import assert from 'node:assert/strict';
import { MOTIFS_DU_CONTENU, OCTETS_MIN, contenuAdmis, extensionDe, texteDeLaPage } from '../src/temoin.mjs';
import { baseDeTest } from './d1.mjs';
import { deposer, temoigner } from '../src/service.mjs';

const octets = (texte) => new TextEncoder().encode(texte);
const remplir = (n) => 'x'.repeat(n);
const PDF = `%PDF-1.7\n${remplir(2000)}\n%%EOF`;
const page = (corps, titre = 'Mairie') => `<!DOCTYPE html><html><head><title>${titre}</title></head><body>${corps}</body></html>`;
const juger = (url, texte, type = null, lue = url) => contenuAdmis({ annoncees: [url, lue], type, octets: octets(texte) });

test('l extension se lit sur le chemin, jamais sur la requete', () => {
	assert.equal(extensionDe('https://x.fr/a/PV.PDF?v=2'), 'pdf');
	assert.equal(extensionDe('https://x.fr/telecharger?f=pv.pdf'), null);
	assert.equal(extensionDe('https://x.fr/.htaccess'), null);
	assert.equal(extensionDe('pas une url'), null);
});

test('un document de moins de 512 octets est refuse, 512 passent', () => {
	assert.deepEqual(juger('https://x.fr/a.csv', remplir(OCTETS_MIN - 1)), { refus: MOTIFS_DU_CONTENU.vide });
	assert.deepEqual(juger('https://x.fr/a.csv', remplir(OCTETS_MIN)), { ok: true });
	assert.deepEqual(contenuAdmis({ annoncees: ['https://x.fr/'], type: null, octets: new Uint8Array(0) }), { refus: MOTIFS_DU_CONTENU.vide });
});

test('un fichier annonce qui rend une page web est refuse, jugee sur ses octets', () => {
	const erreur = page(`<h1>Page introuvable</h1>${remplir(800)}`);
	assert.deepEqual(juger('https://x.fr/pv.pdf', erreur, 'text/html'), { refus: MOTIFS_DU_CONTENU.page });
	assert.deepEqual(juger('https://x.fr/pv.pdf', `\n  ${erreur}`, 'application/octet-stream'), { refus: MOTIFS_DU_CONTENU.page });
	assert.deepEqual(juger('https://x.fr/donnees.csv', erreur, 'text/csv'), { refus: MOTIFS_DU_CONTENU.page });
	// L'extension de l'adresse demandee compte, meme quand la redirection mene a une adresse sans extension.
	assert.deepEqual(juger('https://x.fr/pv.pdf', erreur, 'text/html', 'https://x.fr/connexion'), { refus: MOTIFS_DU_CONTENU.page });
	// Un vrai PDF envoye en text/html par un serveur mal regle passe.
	assert.deepEqual(juger('https://x.fr/pv.pdf', PDF, 'text/html'), { ok: true });
	assert.deepEqual(juger('https://x.fr/pv.pdf', PDF, 'application/pdf'), { ok: true });
});

test('un pdf annonce dont les octets ne sont pas un pdf est refuse', () => {
	assert.deepEqual(juger('https://x.fr/pv.pdf', `{"erreur":"introuvable"}${remplir(600)}`, 'application/json'), { refus: MOTIFS_DU_CONTENU.pasUnPdf });
	assert.deepEqual(juger('https://x.fr/pv.pdf', `${remplir(100)}%PDF-1.4${remplir(600)}`), { ok: true });
});

test('une page de defi anti-robot est refusee, longue ou non', () => {
	const cloudflare = page(`<div id="cf-chl-widget"></div>${remplir(5000)}`, 'Just a moment...');
	assert.deepEqual(juger('https://x.fr/actes', cloudflare, 'text/html; charset=utf-8'), { refus: MOTIFS_DU_CONTENU.defi });
	assert.deepEqual(juger('https://x.fr/', page('<script src="/cdn-cgi/challenge-platform/h/b/orchestrate/jsch/v1"></script>' + remplir(600)), 'text/html'), { refus: MOTIFS_DU_CONTENU.defi });
	assert.deepEqual(juger('https://x.fr/', page(`<iframe src="https://geo.captcha-delivery.com/captcha/"></iframe>${remplir(600)}`), 'text/html'), { refus: MOTIFS_DU_CONTENU.defi });
});

test('un captcha ou une connexion dans une page mince est refuse, pas dans une page de contenu', () => {
	const captcha = page(`<form><div class="g-recaptcha" data-sitekey="k"></div></form>${remplir(600)}`);
	assert.deepEqual(juger('https://x.fr/acces', captcha, 'text/html'), { refus: MOTIFS_DU_CONTENU.captcha });
	const connexion = page(`<form><input name="u"><input type='password' name="p"></form>${remplir(600)}`);
	assert.deepEqual(juger('https://x.fr/espace', connexion, 'text/html'), { refus: MOTIFS_DU_CONTENU.connexion });
	assert.deepEqual(juger('https://x.fr/espace', connexion.replace("type='password'", 'TYPE=PASSWORD'), 'text/html'), { refus: MOTIFS_DU_CONTENU.connexion });
	// Une page de contenu qui porte un formulaire de contact ou de connexion en marge passe.
	const contenu = page(`<article>${'Le conseil municipal a delibere. '.repeat(120)}</article><aside><input type="password"><div class="g-recaptcha"></div></aside>`);
	assert.deepEqual(juger('https://x.fr/actualite', contenu, 'text/html'), { ok: true });
	// Le texte des scripts et des styles ne fait pas une page de contenu.
	const gonflee = page(`<script>${remplir(5000)}</script><style>${remplir(5000)}</style><input type="password">`);
	assert.deepEqual(juger('https://x.fr/espace', gonflee, 'text/html'), { refus: MOTIFS_DU_CONTENU.connexion });
	assert.deepEqual(juger('https://x.fr/', page(remplir(600)), 'text/html'), { ok: true });
	assert.deepEqual(juger('https://x.fr/donnees', `a;b\n${remplir(600)}`, 'text/plain'), { ok: true });
});

test('le texte d une page se lit sans scripts, styles, balises, meme non fermes', () => {
	assert.equal(texteDeLaPage('<p>Un</p><script>x</script><style>y</style> <b>deux</b>'), 'Un deux');
	assert.equal(texteDeLaPage('<p>Un</p><script>jamais ferme'), 'Un');
});

const H = { 'content-type': 'text/html' };
const servir = (statut, corps, entetes = H) => async () => new Response(corps, { status: statut, headers: entetes });
const publique = async () => ['93.184.216.34'];

test('le temoin juge le contenu seulement quand on le lui demande', async () => {
	const admise = { url: 'https://x.fr/pv.pdf', hote: 'x.fr' };
	const erreur = page(remplir(800));
	await assert.rejects(temoigner(admise, { fetch: servir(200, erreur), resoudre: publique, juger: true }), (e) => e.contenu === true && e.message === MOTIFS_DU_CONTENU.page);
	assert.equal((await temoigner(admise, { fetch: servir(200, erreur), resoudre: publique })).taille, erreur.length);
	assert.equal((await temoigner(admise, { fetch: servir(200, PDF, { 'content-type': 'application/pdf' }), resoudre: publique, juger: true })).taille, PDF.length);
});

test('un depot par lien refuse, avec sa raison, un statut hors 2xx et ce qui n est pas le document', async () => {
	const midi = new Date('2026-10-17T12:00:00Z');
	const essai = async (url, fetch) => {
		const r = await deposer({ db: baseDeTest(), corps: { url }, adresse: 'a', maintenant: midi, temoin: (admise, options) => temoigner(admise, { ...options, fetch, resoudre: publique }) });
		return { statut: r.statut, ...JSON.parse(r.corps) };
	};
	assert.deepEqual(await essai('https://x.fr/pv.pdf', servir(403, 'interdit')), { statut: 422, erreur: 'lecture impossible', details: ['la source a repondu 403'] });
	assert.deepEqual(await essai('https://x.fr/pv.pdf', servir(500, 'panne')), { statut: 422, erreur: 'lecture impossible', details: ['la source a repondu 500'] });
	assert.deepEqual((await essai('https://x.fr/pv.pdf', servir(200, page(remplir(800))))).details, [MOTIFS_DU_CONTENU.page]);
	assert.deepEqual((await essai('https://x.fr/pv.pdf', servir(200, 'court'))).details, [MOTIFS_DU_CONTENU.vide]);
	assert.deepEqual((await essai('https://x.fr/actes', servir(200, page(`<div class="cf-turnstile"></div>${remplir(600)}`)))).details, [MOTIFS_DU_CONTENU.captcha]);
	assert.equal((await essai('https://x.fr/pv.pdf', servir(200, PDF, { 'content-type': 'application/pdf' }))).statut, 201);
});
