import { inscriptionDuRecu } from '/chaine.mjs';

const NBSP = '\u00A0';
const cible = document.getElementById('inscription');
const recu = document.getElementById('recu').dataset.recu;
const heure = (id) => `${id.slice(6, 8)}/${id.slice(4, 6)}/${id.slice(0, 4)} ${id.slice(9, 11)}:${id.slice(11, 13)}${NBSP}UTC`;

const bloc = (b) => (b ? `, <a href="https://mempool.space/block/${b}">Bitcoin, bloc ${b}</a>` : ', en cours d’inscription dans Bitcoin');

inscriptionDuRecu(recu, (c) => fetch(c))
	.then((p) => {
		if (p.etat === 'inscrit') cible.innerHTML = `inscrit le ${heure(p.tour)}${bloc(p.bloc)}`;
		else if (p.etat === 'attente') cible.textContent = 'en attente d’inscription';
		else cible.textContent = 'preuve non conforme';
	})
	.catch(() => {
		cible.textContent = 'registre illisible pour le moment';
	});
