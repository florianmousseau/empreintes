import { sha256, placeDuFichier, verifierChaine, verifierSignatureDuJournal, verifierSignatures } from '/chaine.mjs';
import { montrer, suivreLeChoix } from '/fichier.js';
import { idDuRecu } from '/depot.mjs';
import { T } from '/textes.js';

suivreLeChoix(document);

const $ = (id) => document.getElementById(id);
const NBSP = '\u00A0';
const t = T.verifier;
const echapper = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const lire = async (chemin) => {
	const r = await fetch(chemin);
	if (!r.ok) throw new Error(`${chemin}${NBSP}: ${r.status}`);
	return r.json();
};
let tours = null;
const lesTours = async () => (tours ??= (await lire('/tours.json')).tours);

function ancrage(tour) {
	if (tour?.ots === 'bitcoin' && tour.bloc) return `<a href="https://mempool.space/block/${tour.bloc}">${T.bloc(tour.bloc)}</a>`;
	return tour?.ots === 'calendrier' ? T.calendrier : T.aucun;
}

/** La signature du journal d'un tour, relue contre sa racine ; null quand le tour n'en porte pas. */
async function signatureDe(tour, racine) {
	const nom = `${tour.id}.racine.jws`;
	if (!tour.fichiers?.includes(nom)) return null;
	const r = await fetch(`/empreintes/${nom}`);
	const v = r.ok ? await verifierSignatureDuJournal(await r.text(), racine) : { ok: false };
	return { ...v, nom };
}

async function constat(empreinte, vu) {
	const releve = await lire(`/empreintes/${vu.premier}.json`);
	const place = await placeDuFichier(releve, empreinte);
	const tour = (await lesTours()).find((t) => t.id === vu.premier);
	const signature = tour ? await signatureDe(tour, releve.racine) : null;
	const ok = place?.ok && signature?.ok !== false;
	const preuves = (tour?.fichiers ?? [])
		.filter((f) => f.endsWith('.ots') || f.endsWith('.tsr'))
		.map((f) => `<a href="/empreintes/${f}">${f.endsWith('.ots') ? t.preuveOts : t.horodatageTsr}</a>`)
		.join(' ');
	return `<article class="${ok ? 'ok' : 'ko'}">
<h2>${ok ? t.identique(T.jour(vu.jour)) : t.nonConforme}</h2>
<details>
<summary>${t.details}</summary>
<dl>
<div><dt>${t.objet}</dt><dd><code>${echapper(vu.cle)}</code></dd></div>
<div><dt>${t.vu}</dt><dd>${t.duTourAu(T.heure(vu.premier), T.heure(vu.dernier))}</dd></div>
<div><dt>${t.chemin}</dt><dd>${place ? t.etapes(place.chemin.length) : t.absent}</dd></div>
<div><dt>${t.racine}</dt><dd><code class="racine">${releve.racine}</code></dd></div>
<div><dt>Bitcoin</dt><dd>${ancrage(tour)} ${preuves}</dd></div>
${signature ? `<div><dt>${t.signature}</dt><dd><a href="/empreintes/${signature.nom}">${signature.ok ? t.signatureValide : t.signatureNonConforme}</a></dd></div>` : ''}
</dl>
</details>
</article>`;
}

const depot = (l) => `<article class="ok">
<h2>${t.identique(T.jour(l.jour))}</h2>
<p><a href="/recu/${l.recu}">${T.voirLeRecu}</a></p>
</article>`;

async function verifier(empreinte) {
	const sortie = $('resultat');
	sortie.innerHTML = '';
	const [r, d] = await Promise.all([fetch(`/index/${empreinte.slice(0, 2)}.json`), fetch(`/api/depots/${empreinte}`)]);
	const vus = r.ok ? ((await r.json())[empreinte] ?? []) : [];
	const deposes = d.ok ? await d.json() : [];
	if (vus.length === 0 && deposes.length === 0) {
		sortie.innerHTML = `<article class="ko"><h2>${t.jamais}</h2></article>`;
		return;
	}
	for (const l of deposes) sortie.innerHTML += depot(l);
	for (const vu of vus) sortie.innerHTML += await constat(empreinte, vu);
}

/** Le recu telecharge, s'il en est un : sa forme, puis son identifiant cherche dans les depots. */
function recuDans(octets) {
	try {
		const r = JSON.parse(new TextDecoder().decode(octets));
		return [1, 2].includes(r?.version) && /^[0-9a-f]{64}$/.test(r.sha256) && /^[0-9a-f]{32}$/.test(r.sel) ? r : null;
	} catch {
		return null;
	}
}

async function verifierLeRecu(recu) {
	const id = await idDuRecu(recu);
	const r = await fetch(`/api/recus/${id}`);
	$('resultat').innerHTML = r.ok
		? `<article class="ok"><h2>${t.authentique(T.jour(recu.jour))}</h2><p><a href="/recu/${id}">${T.voirLeRecu}</a></p></article>`
		: `<article class="ko"><h2>${t.inconnu}</h2></article>`;
}

async function verifierLeFichier(fichier) {
	const octets = new Uint8Array(await fichier.arrayBuffer());
	const recu = fichier.size < 20000 ? recuDans(octets) : null;
	return recu ? verifierLeRecu(recu) : verifier(await sha256(octets));
}

const lancer = async () => {
	const fichier = $('fichier').files[0];
	const saisie = $('empreinte').value.trim().toLowerCase();
	try {
		if (fichier) await verifierLeFichier(fichier);
		else if (/^[0-9a-f]{64}$/.test(saisie)) await verifier(saisie);
		else $('resultat').innerHTML = `<p>${T.choisir}</p>`;
	} catch (erreur) {
		$('resultat').innerHTML = `<article class="ko"><h2>${T.erreur}</h2><p>${echapper(erreur.message)}</p></article>`;
	}
	if ($('resultat').innerHTML) montrer($('resultat'));
};

// `/verifier?empreinte=<sha256>` : le lien qu'une autre page donne vers la preuve d'un document.
const demandee = new URLSearchParams(location.search).get('empreinte')?.toLowerCase();
if (demandee && /^[0-9a-f]{64}$/.test(demandee) && $('empreinte')) {
	$('empreinte').value = demandee;
	lancer();
}

$('formulaire')?.addEventListener('submit', (e) => {
	e.preventDefault();
	lancer();
});
// Le document depose se verifie aussitot : le bouton ne sert qu'a l'empreinte saisie.
$('fichier')?.addEventListener('change', () => $('fichier').files[0] && lancer());

$('chaine')?.addEventListener('click', async () => {
	const sortie = $('resultat-chaine');
	try {
		const ids = (await lesTours()).map((t) => t.id);
		const v = await verifierChaine(ids, (id) => lire(`/empreintes/${id}.json`), {
			surTour: (id) => (sortie.innerHTML = `<p>${t.tour(T.heure(id))}</p>`)
		});
		const s = await verifierSignatures(await lesTours(), async (chemin) => (await fetch(chemin)).text());
		const raisons = [...v.raisons, ...s.raisons];
		sortie.innerHTML = raisons.length === 0
			? `<article class="ok"><h2>${t.intacte(v.tours)}</h2><p>${t.signatures(s.signees)}</p><p>${t.derniere} <code class="racine">${v.derniere}</code></p></article>`
			: `<article class="ko"><h2>${t.rompue}</h2><ul>${raisons.map((r) => `<li>${echapper(r)}</li>`).join('')}</ul></article>`;
	} catch (erreur) {
		sortie.innerHTML = `<article class="ko"><h2>${T.erreur}</h2><p>${echapper(erreur.message)}</p></article>`;
	}
});
