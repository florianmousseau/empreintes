import { inscriptionDuRecu } from '/chaine.mjs';
import { T } from '/textes.js';

document.getElementById('imprimer')?.addEventListener('click', () => window.print());
const cible = document.getElementById('inscription');
const recu = document.getElementById('recu').dataset.recu;

const bloc = (b) => (b ? `, <a href="https://mempool.space/block/${b}">${T.bloc(b)}</a>` : `, ${T.calendrier}`);

inscriptionDuRecu(recu, (c) => fetch(c))
	.then((p) => {
		if (p.etat === 'inscrit') cible.innerHTML = `${T.recu.inscrit(T.heure(p.tour))}${bloc(p.bloc)}`;
		else if (p.etat === 'attente') cible.textContent = T.recu.attente;
		else cible.textContent = T.recu.nonConforme;
	})
	.catch(() => {
		cible.textContent = T.recu.illisible;
	});
