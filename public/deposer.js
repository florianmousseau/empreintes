import { sha256 } from '/chaine.mjs';
import { suivreLeChoix } from '/fichier.js';
import { communeDe, communeDeLAdresse } from '/annuaire.mjs';
import { T } from '/textes.js';

const $ = (id) => document.getElementById(id);
const $fichier = () => $('fichier');
const t = T.deposer;

if ($fichier()) suivreLeChoix(document);

// L'empreinte du document choisi, calculee une fois : elle sert a dire s'il est deja date, puis au depot.
let choisi = null;
const empreinteDe = async (fichier) => {
	if (choisi?.fichier !== fichier) choisi = { fichier, sha256: sha256(new Uint8Array(await fichier.arrayBuffer())) };
	return choisi.sha256;
};

async function dejaDate() {
	const deja = $('deja');
	const fichier = $fichier()?.files[0];
	deja.hidden = true;
	if (!fichier) return;
	try {
		const r = await fetch(`/api/depots/${await empreinteDe(fichier)}`);
		const lignes = r.ok ? await r.json() : [];
		if (!lignes.length || $fichier().files[0] !== fichier) return;
		const premier = lignes[0];
		deja.innerHTML = `${t.deja(T.jour(premier.jour))} <a href="/recu/${premier.recu}">${T.voirLeRecu}</a>`;
		deja.hidden = false;
	} catch {
		// Une lecture manquee ne bloque pas le depot.
	}
}

const echapper = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
if ($('deja')) $fichier().addEventListener('change', dejaDate);

// Un lien sur le site officiel d'une commune : on propose d'en faire un acte, la commune deja reconnue.
// L'edition allemande n'a ni le bloc ni le champ : le lien y reste un document.
let lecture = 0;
async function reconnaitreLaCommune() {
	const url = $('url').value.trim();
	const numero = ++lecture;
	let insee = null;
	let commune = null;
	if (/^https?:\/\/[^/]+\.[^/]+/i.test(url)) {
		try {
			insee = await communeDeLAdresse(url, (c) => fetch(c));
			commune = insee ? await communeDe(insee, (c) => fetch(c)) : null;
		} catch {
			insee = null;
		}
	}
	if (numero !== lecture) return;
	const bloc = $('acte');
	if (bloc) {
		bloc.hidden = !insee;
		$('collectivite').value = insee ?? '';
		$('acte-commune').textContent = commune?.nom ?? t.commune(insee);
		if (!insee && $('nature').value) {
			$('nature').value = '';
			$('nature').dispatchEvent(new Event('change'));
		}
	} else if (insee && $('collectivite') && !$('collectivite').value) $('collectivite').value = insee;
}

// Le bouton dit ce qui sera date.
// Un acte se date avec son objet.
// Au chargement aussi : un retour arriere rend au menu la nature choisie sans
// declencher `change` (mesure le 2026-10-13 : « Délibération » restituee, bouton
// « Dater ce document », objet facultatif, et le refus ne venait que du serveur).
const accorderALaNature = () => {
	const acte = Boolean($('nature').value);
	$('formulaire').querySelector('button[type=submit]').textContent = acte ? t.daterActe : t.daterDocument;
	$('objet').required = acte;
};
if ($('acte')) {
	$('nature').addEventListener('change', accorderALaNature);
	accorderALaNature();
	window.addEventListener('pageshow', accorderALaNature);
}

let attente;
$('url')?.addEventListener('input', () => {
	if ($fichier()?.files.length && $('url').value.trim()) {
		$fichier().value = '';
		$fichier().dispatchEvent(new Event('change'));
	}
	clearTimeout(attente);
	attente = setTimeout(reconnaitreLaCommune, 350);
});
// Un fichier choisi remplace le lien : un seul document par depot.
$fichier()?.addEventListener('change', () => {
	if (!$fichier().files.length || !$('url').value) return;
	$('url').value = '';
	reconnaitreLaCommune();
});

// Seul un acte lu sur le site officiel entre dans la serie publique de sa collectivite.
const collectivite = (acte) =>
	acte.rattachement === 'site-officiel' ? `<a href="/collectivite/${encodeURIComponent(acte.collectivite)}">${echapper(acte.collectivite)}</a>` : echapper(acte.collectivite);

function telecharger(recu, id) {
	const lien = document.createElement('a');
	lien.href = URL.createObjectURL(new Blob([`${JSON.stringify(recu, null, 1)}\n`], { type: 'application/json' }));
	lien.download = `${t.fichier}-${id.slice(0, 16)}.json`;
	lien.click();
	URL.revokeObjectURL(lien.href);
}

function afficher(r) {
	const source = r.recu.temoin ? `${t.luA} <code>${echapper(r.recu.temoin.url)}</code>` : t.calculee;
	const acte = r.recu.acte;
	const tete = acte
		? `<h2>${t.recuActe(t.natures[acte.nature], T.jour(r.recu.temoin.lu.slice(0, 10)), r.recu.temoin.lu.slice(11, 16))}</h2>
<p>${t.collectivite} ${collectivite(acte)}, ${t.rattachement[acte.rattachement]}.</p>`
		: `<h2>${t.recuDocument(T.jour(r.jour))}</h2>`;
	$('resultat').innerHTML = `<article class="ok">
${tete}
${r.recu.libelle ? `<p><strong>${echapper(r.recu.libelle)}</strong></p>` : ''}
<p>${acte ? t.enLigne : t.gardez}</p>
<p class="gestes"><button type="button" id="imprimer" class="principal">${t.imprimer}</button> <button type="button" id="recu">${t.telecharger}</button></p>
<details>
<summary>${t.details}</summary>
<dl>
<div><dt>${t.empreinte}</dt><dd><code class="racine">${r.recu.sha256}</code>, ${source}</dd></div>
<div><dt>${t.recu}</dt><dd><code class="racine">${r.id}</code>, ${t.ligne(r.place, T.jour(r.jour))}</dd></div>
</dl>
</details>
<p>${t.adresse} <a href="/recu/${r.id}">${T.hote}/recu/${r.id.slice(0, 12)}</a></p>
<p class="imprime">${T.hote}/recu/${r.id}<br>${t.emis(T.jour(r.recu.depose.slice(0, 10)), r.recu.depose.slice(11, 16))}</p>
</article>`;
	$('recu').addEventListener('click', () => telecharger(r.recu, r.id));
	$('imprimer').addEventListener('click', () => {
		for (const d of document.querySelectorAll('#resultat details')) d.open = true;
		window.print();
	});
}

const valeur = (id) => $(id)?.value.trim() ?? '';

async function demande() {
	if ($('nature')?.value && $('collectivite').value) return { type: 'acte', url: valeur('url'), collectivite: valeur('collectivite'), nature: $('nature').value, libelle: valeur('objet') };
	const libelle = valeur('libelle');
	const fichier = $fichier()?.files[0];
	const saisie = $('empreinte')?.value.trim();
	const url = $('url')?.value.trim();
	const corps = libelle ? { libelle } : {};
	if (fichier) return { ...corps, sha256: await empreinteDe(fichier) };
	if (saisie) return { ...corps, sha256: saisie };
	if (url) return { ...corps, url };
	return null;
}

$('formulaire').addEventListener('submit', async (e) => {
	e.preventDefault();
	const bouton = e.submitter ?? $('formulaire').querySelector('button');
	bouton.disabled = true;
	try {
		const corps = await demande();
		if (!corps) {
			$('resultat').innerHTML = `<p>${T.choisir}</p>`;
			return;
		}
		const r = await fetch('/api/depots', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corps) });
		const reponse = await r.json();
		if (r.status === 201) return afficher(reponse);
		$('resultat').innerHTML = `<article class="ko"><h2>${t.refus[r.status] ?? echapper(reponse.erreur)}</h2>${(reponse.details ?? []).map((d) => `<p>${echapper(d)}</p>`).join('')}</article>`;
	} catch (erreur) {
		$('resultat').innerHTML = `<article class="ko"><h2>${T.erreurAvec(echapper(erreur.message))}</h2></article>`;
	} finally {
		bouton.disabled = false;
	}
});
