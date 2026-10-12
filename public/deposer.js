import { sha256 } from '/chaine.mjs';
import { suivreLeChoix } from '/fichier.js';

const $ = (id) => document.getElementById(id);
const $fichier = () => $('fichier');

if ($fichier()) suivreLeChoix(document);

const NBSP = '\u00A0';
const echapper = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const TITRES = { 409: 'Ce document en ligne a déjà été lu aujourd’hui', 422: 'Le document en ligne n’a pas pu être lu', 429: 'Limite du jour atteinte, à demain' };
const jourFr = (j) => j.split('-').reverse().join('/');
const NATURES = { deliberation: 'Délibération', arrete: 'Arrêté', decision: 'Décision' };
const RATTACHEMENT = { 'site-officiel': 'adresse sur son site officiel', declaree: 'déclarée' };

// Seul un acte lu sur le site officiel entre dans la serie publique de sa collectivite.
const collectivite = (acte) =>
	acte.rattachement === 'site-officiel' ? `<a href="/collectivite/${encodeURIComponent(acte.collectivite)}">${echapper(acte.collectivite)}</a>` : echapper(acte.collectivite);

function telecharger(recu, id) {
	const lien = document.createElement('a');
	lien.href = URL.createObjectURL(new Blob([`${JSON.stringify(recu, null, 1)}\n`], { type: 'application/json' }));
	lien.download = `recu-${id.slice(0, 16)}.json`;
	lien.click();
	URL.revokeObjectURL(lien.href);
}

function afficher(r) {
	const source = r.recu.temoin ? `lu à <code>${echapper(r.recu.temoin.url)}</code>` : 'calculée sur votre appareil';
	const acte = r.recu.acte;
	const tete = acte
		? `<h2>Reçu${NBSP}: ${NATURES[acte.nature]} du ${jourFr(r.recu.temoin.lu.slice(0, 10))}, ${r.recu.temoin.lu.slice(11, 16)}${NBSP}UTC</h2>
<p>Collectivité ${collectivite(acte)}, ${RATTACHEMENT[acte.rattachement]}.</p>`
		: `<h2>Reçu${NBSP}: document daté du ${jourFr(r.jour)}</h2>`;
	$('resultat').innerHTML = `<article class="ok">
${tete}
${r.recu.libelle ? `<p><strong>${echapper(r.recu.libelle)}</strong></p>` : ''}
<p>${acte ? `Ce fichier était en ligne à cette adresse à cet instant.` : `Gardez ce reçu avec le document${NBSP}: ensemble, ils prouvent qu’il existait ce jour-là, sans modification.`}</p>
<p class="gestes"><button type="button" id="imprimer" class="principal">Imprimer le reçu</button> <button type="button" id="recu">Télécharger le reçu</button></p>
<details>
<summary>Détails</summary>
<dl>
<div><dt>Empreinte</dt><dd><code class="racine">${r.recu.sha256}</code>, ${source}</dd></div>
<div><dt>Reçu</dt><dd><code class="racine">${r.id}</code>, ligne ${r.place} du ${jourFr(r.jour)}</dd></div>
</dl>
</details>
<p>Adresse du reçu${NBSP}: <a href="/recu/${r.id}">temoinpublic.fr/recu/${r.id.slice(0, 12)}</a></p>
<p class="imprime">temoinpublic.fr/recu/${r.id}<br>Émis le ${jourFr(r.recu.depose.slice(0, 10))} à ${r.recu.depose.slice(11, 16)}${NBSP}UTC.</p>
</article>`;
	$('recu').addEventListener('click', () => telecharger(r.recu, r.id));
	$('imprimer').addEventListener('click', () => {
		for (const d of document.querySelectorAll('#resultat details')) d.open = true;
		window.print();
	});
}

async function demande() {
	const libelle = $('libelle').value.trim();
	if ($('collectivite')) return { type: 'acte', url: $('url').value.trim(), collectivite: $('collectivite').value.trim(), nature: $('nature').value, ...(libelle ? { libelle } : {}) };
	const fichier = $('fichier').files[0];
	const saisie = $('empreinte').value.trim();
	const url = $('url').value.trim();
	const corps = libelle ? { libelle } : {};
	if (fichier) return { ...corps, sha256: await sha256(new Uint8Array(await fichier.arrayBuffer())) };
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
			$('resultat').innerHTML = '<p>Choisir le document.</p>';
			return;
		}
		const r = await fetch('/api/depots', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corps) });
		const reponse = await r.json();
		if (r.status === 201) return afficher(reponse);
		$('resultat').innerHTML = `<article class="ko"><h2>${TITRES[r.status] ?? echapper(reponse.erreur)}</h2>${(reponse.details ?? []).map((d) => `<p>${echapper(d)}</p>`).join('')}</article>`;
	} catch (erreur) {
		$('resultat').innerHTML = `<article class="ko"><h2>Erreur${NBSP}: ${echapper(erreur.message)}</h2></article>`;
	} finally {
		bouton.disabled = false;
	}
});
