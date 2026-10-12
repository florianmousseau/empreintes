import { sha256 } from '/chaine.mjs';

const $ = (id) => document.getElementById(id);
const NBSP = ' ';
const echapper = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const jourFr = (j) => j.split('-').reverse().join('/');

function telecharger(recu, id) {
	const lien = document.createElement('a');
	lien.href = URL.createObjectURL(new Blob([`${JSON.stringify(recu, null, 1)}\n`], { type: 'application/json' }));
	lien.download = `recu-${id.slice(0, 16)}.json`;
	lien.click();
	URL.revokeObjectURL(lien.href);
}

function afficher(r) {
	const source = r.recu.temoin
		? `lu à <code>${echapper(r.recu.temoin.url)}</code>, ${r.recu.temoin.taille.toLocaleString('fr-FR')} octets`
		: 'déclarée';
	$('resultat').innerHTML = `<article class="ok">
<h2>Déposé le ${jourFr(r.jour)}, place ${r.place}</h2>
<dl>
<div><dt>Empreinte</dt><dd><code class="racine">${r.recu.sha256}</code></dd></div>
<div><dt>Source</dt><dd>${source}</dd></div>
<div><dt>Reçu</dt><dd><code class="racine">${r.id}</code></dd></div>
<div><dt>Journal</dt><dd>au prochain tour, ancrage Bitcoin le lendemain</dd></div>
</dl>
<p><button type="button" id="recu">Télécharger le reçu</button></p>
</article>`;
	$('recu').addEventListener('click', () => telecharger(r.recu, r.id));
}

async function demande() {
	const fichier = $('fichier').files[0];
	const saisie = $('empreinte').value.trim();
	const url = $('url').value.trim();
	const libelle = $('libelle').value.trim();
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
			$('resultat').innerHTML = '<p>Choisir un fichier, saisir une empreinte ou une adresse.</p>';
			return;
		}
		const r = await fetch('/api/depots', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corps) });
		const reponse = await r.json();
		if (r.status === 201) return afficher(reponse);
		$('resultat').innerHTML = `<article class="ko"><h2>${echapper(reponse.erreur)}</h2>${(reponse.details ?? []).map((d) => `<p>${echapper(d)}</p>`).join('')}</article>`;
	} catch (erreur) {
		$('resultat').innerHTML = `<article class="ko"><h2>Erreur${NBSP}: ${echapper(erreur.message)}</h2></article>`;
	} finally {
		bouton.disabled = false;
	}
});
