// La famille « besoins » (D-177, chantier 5) : une page par besoin cherche,
// chacune avec le geste de dater sur la page. En francais seulement. Le besoin
// « date de publication d'un acte de commune » a deja sa page, `/acte`.

/** Chaque besoin : son adresse, son geste (`lien` ou `fichier`), son titre (la recherche telle qu'on la tape), sa phrase, sa description. */
export const BESOINS = [
	{
		chemin: '/besoin/prouver-une-page-web',
		geste: 'lien',
		nom: 'une page web',
		titre: 'Prouver qu’une page web existait à une date',
		chapeau: 'Collez son adresse. Témoin public lit la page, inscrit son empreinte au registre et vous remet un reçu daté.',
		description: "Prouver gratuitement qu'une page web était en ligne, telle quelle, à une date : son empreinte est inscrite dans un registre public ancré dans Bitcoin."
	},
	{
		chemin: '/besoin/anteriorite-d-une-creation',
		geste: 'fichier',
		nom: 'une création',
		titre: 'Prouver l’antériorité d’une création',
		chapeau: 'Datez-la avant de la montrer ou de l’envoyer. Le fichier ne quitte pas votre appareil, seule son empreinte est inscrite, avec la date.',
		description: "Prouver gratuitement qu'un texte, un plan, une image ou un code existait à une date, sans confier le fichier : son empreinte est inscrite dans un registre public."
	},
	{
		chemin: '/besoin/avis-ou-annonce-supprime',
		geste: 'lien',
		nom: 'un avis ou une annonce',
		titre: 'Garder la preuve d’un avis ou d’une annonce avant sa suppression',
		chapeau: 'Collez l’adresse de la page tant qu’elle est en ligne. Le reçu atteste ce qui y était servi, à cet instant.',
		description: "Garder gratuitement la preuve d'un avis, d'une annonce ou d'un commentaire en ligne avant qu'il soit modifié ou supprimé : un reçu daté, vérifiable par tous."
	}
];
