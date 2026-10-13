// La zone de depot : le nom du document choisi, et le glisser-deposer sur la meme entree.
import { T } from '/textes.js';

export function suivreLeChoix(document) {
	const champ = document.getElementById('fichier');
	const nom = document.getElementById('nom-fichier');
	const zone = document.getElementById('zone');
	if (!champ) return;
	champ.addEventListener('change', () => {
		const f = champ.files[0];
		nom.textContent = f?.name ?? T.aucunDocument;
		zone?.classList.toggle('choisi', Boolean(f));
	});
	if (!zone) return;
	const survol = (actif) => (e) => {
		e.preventDefault();
		zone.classList.toggle('survol', actif);
	};
	zone.addEventListener('dragover', survol(true));
	zone.addEventListener('dragleave', survol(false));
	zone.addEventListener('drop', (e) => {
		survol(false)(e);
		if (!e.dataTransfer?.files.length) return;
		champ.files = e.dataTransfer.files;
		champ.dispatchEvent(new Event('change'));
	});
}

/** Amene le resultat sous les yeux : sur telephone, il nait sous le bouton, hors de l'ecran. */
export function montrer(element) {
	const doux = !matchMedia('(prefers-reduced-motion: reduce)').matches;
	element.scrollIntoView({ behavior: doux ? 'smooth' : 'auto', block: 'start' });
}
