import { sha256, placeDuFichier, verifierChaine } from '/chaine.mjs';

const $ = (id) => document.getElementById(id);
const NBSP = ' ';
const echapper = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const jourFr = (j) => (j ? j.split('-').reverse().join('/') : 'jour inconnu');
const heure = (id) => `${id.slice(6, 8)}/${id.slice(4, 6)}/${id.slice(0, 4)} ${id.slice(9, 11)}:${id.slice(11, 13)}${NBSP}UTC`;

const lire = async (chemin) => {
	const r = await fetch(chemin);
	if (!r.ok) throw new Error(`${chemin}${NBSP}: ${r.status}`);
	return r.json();
};
let tours = null;
const lesTours = async () => (tours ??= (await lire('/tours.json')).tours);

function ancrage(t) {
	if (t?.ots === 'bitcoin' && t.bloc) return `<a href="https://mempool.space/block/${t.bloc}">Bitcoin, bloc ${t.bloc}</a>`;
	return t?.ots === 'calendrier' ? 'en attente du bloc' : 'aucun';
}

async function constat(empreinte, vu) {
	const releve = await lire(`/empreintes/${vu.premier}.json`);
	const place = await placeDuFichier(releve, empreinte);
	const tour = (await lesTours()).find((t) => t.id === vu.premier);
	const preuves = (tour?.fichiers ?? [])
		.filter((f) => f.endsWith('.ots') || f.endsWith('.tsr'))
		.map((f) => `<a href="/empreintes/${f}">${f.endsWith('.ots') ? 'preuve .ots' : 'horodatage .tsr'}</a>`)
		.join(' ');
	return `<article class="${place?.ok ? 'ok' : 'ko'}">
<h2>${place?.ok ? `Servi tel quel le ${jourFr(vu.jour)}` : 'Chemin d’audit non conforme'}</h2>
<dl>
<div><dt>Objet</dt><dd><code>${echapper(vu.cle)}</code></dd></div>
<div><dt>Vu</dt><dd>du tour ${heure(vu.premier)} au tour ${heure(vu.dernier)}</dd></div>
<div><dt>Chemin d’audit</dt><dd>${place ? `${place.chemin.length} étapes, racine recalculée` : 'absent du relevé'}</dd></div>
<div><dt>Racine du tour</dt><dd><code class="racine">${releve.racine}</code></dd></div>
<div><dt>Ancrage</dt><dd>${ancrage(tour)} ${preuves}</dd></div>
</dl>
</article>`;
}

async function verifier(empreinte) {
	const sortie = $('resultat');
	sortie.innerHTML = `<p>Empreinte${NBSP}: <code class="racine">${empreinte}</code></p>`;
	const r = await fetch(`/index/${empreinte.slice(0, 2)}.json`);
	const vus = r.ok ? ((await r.json())[empreinte] ?? []) : [];
	if (vus.length === 0) {
		sortie.innerHTML += '<article class="ko"><h2>Inconnu du journal</h2></article>';
		return;
	}
	for (const vu of vus) sortie.innerHTML += await constat(empreinte, vu);
}

$('formulaire').addEventListener('submit', async (e) => {
	e.preventDefault();
	const fichier = $('fichier').files[0];
	const saisie = $('empreinte').value.trim().toLowerCase();
	try {
		if (fichier) await verifier(await sha256(new Uint8Array(await fichier.arrayBuffer())));
		else if (/^[0-9a-f]{64}$/.test(saisie)) await verifier(saisie);
		else $('resultat').innerHTML = '<p>Choisir un fichier ou saisir 64 caractères hexadécimaux.</p>';
	} catch (erreur) {
		$('resultat').innerHTML = `<article class="ko"><h2>Erreur</h2><p>${echapper(erreur.message)}</p></article>`;
	}
});

$('chaine').addEventListener('click', async () => {
	const sortie = $('resultat-chaine');
	try {
		const ids = (await lesTours()).map((t) => t.id);
		const v = await verifierChaine(ids, (id) => lire(`/empreintes/${id}.json`), {
			surTour: (id) => (sortie.innerHTML = `<p>Tour ${heure(id)}</p>`)
		});
		sortie.innerHTML = v.ok
			? `<article class="ok"><h2>Chaîne intacte, ${v.tours} tours</h2><p>Dernière racine${NBSP}: <code class="racine">${v.derniere}</code></p></article>`
			: `<article class="ko"><h2>Chaîne rompue</h2><ul>${v.raisons.map((r) => `<li>${echapper(r)}</li>`).join('')}</ul></article>`;
	} catch (erreur) {
		sortie.innerHTML = `<article class="ko"><h2>Erreur</h2><p>${echapper(erreur.message)}</p></article>`;
	}
});
