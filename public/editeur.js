// Le registre prive d'un editeur : le jeton vit dans le fragment de l'adresse, jamais envoye au serveur
// autrement qu'en en-tete ; l'adresse de chaque article et les recus ne s'affichent qu'ici.
const section = document.getElementById('prive');
const jeton = location.hash.slice(1);

function telecharger(nom, valeur) {
	const lien = document.createElement('a');
	lien.href = URL.createObjectURL(new Blob([`${JSON.stringify(valeur, null, 1)}\n`], { type: 'application/json' }));
	lien.download = nom;
	lien.click();
	URL.revokeObjectURL(lien.href);
}

/** Un element, son texte et ses attributs : rien de ce que l'API rend ne passe par innerHTML. */
function el(nom, texte = '', attributs = {}) {
	const e = document.createElement(nom);
	e.textContent = texte;
	for (const [k, v] of Object.entries(attributs)) e.setAttribute(k, v);
	return e;
}

/** Un lien vers une adresse http(s), ou le texte seul. */
const lien = (adresse) => (/^https?:\/\//.test(adresse) ? el('a', adresse, { href: adresse }) : el('span', adresse));

function bouton(texte, principal, action) {
	const b = el('button', texte, { type: 'button', ...(principal ? { class: 'principal' } : {}) });
	b.addEventListener('click', action);
	return b;
}

async function afficher(id, entete) {
	const r = await fetch(`/api/flux/${id}`, { headers: entete });
	if (!r.ok) throw new Error(String(r.status));
	const { flux, articles, recus } = await r.json();
	const liste = el('ul');
	for (const a of articles) {
		const li = el('li');
		li.append(el('code', a.id.slice(0, 12)), ' ', lien(a.lien));
		liste.append(li);
	}
	const source = el('p', 'Flux\u00A0: ');
	source.append(lien(flux.url));
	const gestes = el('p', '', { class: 'gestes' });
	gestes.append(bouton('Télécharger les reçus', true, () => telecharger(`recus-${id}.json`, recus)));
	if (!flux.retire)
		gestes.append(
			' ',
			bouton('Cesser de suivre ce flux', false, async () => {
				if (!confirm('Cesser de suivre ce flux\u00A0? Les dates déjà enregistrées restent.')) return;
				const reponse = await fetch(`/api/flux/${id}`, { method: 'DELETE', headers: entete });
				if (reponse.ok) location.reload();
			})
		);
	section.replaceChildren(el('h2', 'Vos articles'), source, liste, gestes);
	section.hidden = false;
}

if (/^[0-9a-f]{64}$/.test(jeton)) {
	try {
		await afficher(section.dataset.flux, { authorization: `Bearer ${jeton}` });
	} catch {
		section.replaceChildren(el('p', 'Lien privé refusé.'));
		section.hidden = false;
	}
}
