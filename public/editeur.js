// Le registre prive d'un editeur : le jeton vit dans le fragment de l'adresse, jamais envoye au serveur
// autrement qu'en en-tete ; l'adresse de chaque article et les recus ne s'affichent qu'ici.
const section = document.getElementById('prive');
const jeton = location.hash.slice(1);
const echapper = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function telecharger(nom, valeur) {
	const lien = document.createElement('a');
	lien.href = URL.createObjectURL(new Blob([`${JSON.stringify(valeur, null, 1)}\n`], { type: 'application/json' }));
	lien.download = nom;
	lien.click();
	URL.revokeObjectURL(lien.href);
}

async function afficher(id, entete) {
	const r = await fetch(`/api/flux/${id}`, { headers: entete });
	if (!r.ok) throw new Error(String(r.status));
	const { flux, articles, recus } = await r.json();
	const lignes = articles.map((a) => `<li><code>${a.id.slice(0, 12)}</code> <a href="${echapper(a.lien)}">${echapper(a.lien)}</a></li>`).join('');
	const retrait = flux.retire ? '' : ' <button type="button" id="retirer">Cesser de suivre ce flux</button>';
	section.innerHTML = `<h2>Vos articles</h2>
<p>Flux\u00A0: <a href="${echapper(flux.url)}">${echapper(flux.url)}</a></p>
<ul>${lignes}</ul>
<p class="gestes"><button type="button" id="recus" class="principal">Télécharger les reçus</button>${retrait}</p>`;
	section.hidden = false;
	document.getElementById('recus').addEventListener('click', () => telecharger(`recus-${id}.json`, recus));
	document.getElementById('retirer')?.addEventListener('click', async () => {
		if (!confirm('Cesser de suivre ce flux\u00A0? Les dates déjà enregistrées restent.')) return;
		const reponse = await fetch(`/api/flux/${id}`, { method: 'DELETE', headers: entete });
		if (reponse.ok) location.reload();
	});
}

if (/^[0-9a-f]{64}$/.test(jeton)) {
	try {
		await afficher(section.dataset.flux, { authorization: `Bearer ${jeton}` });
	} catch {
		section.innerHTML = '<p>Lien privé refusé.</p>';
		section.hidden = false;
	}
}
