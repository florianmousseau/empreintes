// Le nom du document choisi, a cote du bouton en francais.
export function suivreLeChoix(document) {
	const champ = document.getElementById('fichier');
	const nom = document.getElementById('nom-fichier');
	champ?.addEventListener('change', () => {
		nom.textContent = champ.files[0]?.name ?? 'Aucun document choisi';
	});
}
