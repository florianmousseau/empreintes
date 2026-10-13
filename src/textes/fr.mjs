// L'edition francaise : Témoin public, sur temoinpublic.fr. Les textes des pages,
// et la facon d'ecrire les dates et les nombres. Les scripts du navigateur ont
// les leurs dans `public/textes.js`.

const NBSP = '\u00A0';
const jour = (j) => j.split('-').reverse().join('/');
const pluriel = (n) => (n > 1 ? 's' : '');
const nombre = (n) => n.toLocaleString('fr-FR').replace(/\u202f/g, NBSP);

export default {
	langue: 'fr',
	locale: 'fr_FR',
	hote: 'temoinpublic.fr',
	adresse: 'https://temoinpublic.fr',
	marque: 'Témoin public',
	avecActes: true,
	actes: {
		dater: { chemin: '/deposer', nom: 'Dater', titre: 'Dater un document' },
		verifier: { chemin: '/verifier', nom: 'Vérifier', titre: 'Vérifier un document' },
		journal: { chemin: '/journal', nom: 'Registre', titre: 'Registre des dates' },
		acte: { chemin: '/acte', nom: 'Acte de collectivité', titre: 'Dater la mise en ligne d’un acte' },
		documentation: { chemin: '/documentation', nom: 'Documentation', titre: 'Documentation' },
		mentions: { chemin: '/mentions-legales', nom: 'Mentions légales', titre: 'Mentions légales' }
	},
	jour,
	nombre,
	structure: {
		description: "Prouver gratuitement qu'un document existait à une date, sans modification : son empreinte est inscrite dans un registre public ancré dans Bitcoin."
	},
	navigation: 'Principal',
	codeSource: 'Code source',
	ancrage: { bitcoin: (bloc) => `Bitcoin, bloc ${bloc}`, calendrier: 'en cours d’inscription dans Bitcoin', aucun: 'aucun' },
	fichiers: { json: 'relevé', racine: 'racine', 'racine.ots': '.ots', 'racine.tsr': '.tsr' },
	zone: { glisser: 'Glissez-le ici, ou ', choisir: 'choisissez-le sur votre appareil', aucun: 'Aucun document choisi' },
	empreinte: { question: `Une empreinte SHA-256${NBSP}?`, libelle: 'Son empreinte SHA-256' },
	formulaire: {
		deposez: 'Déposez le document à dater',
		ou: 'ou',
		lien: 'Le lien d’un document en ligne',
		exemple: 'https://www.ma-commune.fr/deliberation.pdf',
		nommer: 'Lui donner un nom (facultatif)',
		nom: 'Un nom',
		bouton: 'Dater ce document',
		recoit: 'Vous recevez un reçu à imprimer ou à télécharger, à garder avec le document. Un fichier déposé ne quitte jamais votre appareil.'
	},
	etapes: [
		['Déposez', 'Un devis, un contrat, une photo, un PDF.'],
		['Gardez le reçu', 'Daté, à imprimer, avec le document.'],
		['Vérifiez', 'N’importe qui, à tout moment, sans compte.']
	],
	accueil: {
		titre: 'Prouver la date d’un document',
		description: "Prouvez gratuitement qu'un document existait à une date, sans modification. Sans compte ; seule son empreinte est publiée, jamais le document.",
		h1: 'Prouvez qu’un document existait à une date, sans modification.',
		chapeau: 'Gratuit, sans compte. Vérifiable par tous, même sans ce site.',
		deja: `Déjà daté${NBSP}?`,
		compte: (n, j) => `${nombre(n)} dates enregistrées depuis le ${j}.`
	},
	journal: {
		description: 'Chaque tour du journal des empreintes : documents, racine chaînée, ancrage Bitcoin, fichiers de preuve.',
		sousTitre: 'La liste publique des dates, sans les documents.',
		chiffres: ['Documents', 'Tours', 'Depuis le'],
		derniereRacine: (dh) => `Dernière racine, ${dh}`,
		verifierChaine: 'Vérifier la chaîne',
		aucunTour: 'Aucun tour publié.',
		tours: (n) => `${nombre(n)} tours`,
		colonnes: ['Tour', 'Documents', 'Racine', 'Bitcoin', 'Fichiers'],
		script: 'Script de vérification'
	},
	verifier: {
		description: "Vérifier qu'un document est identique à celui qui a été daté, et à quelle date.",
		deposez: 'Déposez le document ou son reçu',
		autrement: `Pas le fichier sous la main${NBSP}?`,
		bouton: 'Vérifier'
	},
	deposer: {
		description: 'Dater gratuitement un document, ancré dans Bitcoin, et recevoir un reçu à imprimer. Seule son empreinte est publiée, jamais le document.',
		compte: `Gratuit, sans compte, jusqu’à 20 documents par jour. Valeur juridique${NBSP}: un élément de preuve, que le juge apprécie librement.`
	},
	recu: {
		titre: (j) => `Reçu de date du ${j}`,
		description: (acte, j, place) => `Reçu de date${NBSP}: ${acte ? 'acte en ligne' : 'document daté'} le ${j}, ligne ${place}.`,
		h1: 'Reçu de date',
		enLigne: (j) => `En ligne le ${j}`,
		date: (j) => `Document daté du ${j}`,
		acte: 'Acte',
		collectivite: 'Collectivité',
		adresseCollectivite: (code) => `/collectivite/${code}`,
		sansObjet: 'Sans objet',
		natures: { deliberation: 'Délibération', arrete: 'Arrêté', decision: 'Décision' },
		empreinte: 'Empreinte',
		ligne: 'Ligne',
		place: (place, j) => `${place} du ${j}`,
		registre: 'Registre',
		lecture: 'lecture du registre',
		imprimer: 'Imprimer le reçu'
	},
	editeur: {
		titre: (id) => `Registre de l’éditeur ${id}`,
		description: (id) => `Les versions datées des articles du flux ${id}${NBSP}: date, ligne du registre, empreinte.`,
		h1: 'Registre de l’éditeur',
		flux: (id, etat) => `Flux ${id}. ${etat}.`,
		suiviDepuis: (j) => `Suivi depuis le ${j}`,
		suiviDuAu: (a, b) => `Suivi du ${a} au ${b}`,
		colonnes: ['Article', 'Versions', 'Datée le', 'Ligne', 'Empreinte'],
		compte: (articles, versions) => `${nombre(versions)} version${pluriel(versions)}, ${nombre(articles)} article${pluriel(articles)}`,
		aucune: 'Aucune version datée',
		coupe: (montrees, total) => `Les ${nombre(montrees)} plus récentes sur ${nombre(total)}.`
	},
	recuInconnu: { titre: 'Reçu inconnu', description: 'Aucun dépôt ne porte ce reçu.' },
	introuvable: { titre: 'Page introuvable', description: 'Aucune page à cette adresse.' },
	documentation: {
		description: 'Adresses, limites et formules du registre des dates : dater, lire et vérifier sans ce site.',
		titres: ['Dater', 'Lire', 'Vérifier sans ce site'],
		dater: {
			empreinte: 'une empreinte calculée par vous\u00A0; le libellé reste dans le reçu',
			url: 'le service lit lui-même le document en ligne et date ses octets',
			acte: 'un acte de collectivité, lu à son adresse, avec son objet\u00A0; reçu version 2, ligne publique inchangée',
			cree: 'le reçu, son identifiant, la ligne publique',
			flux: 'suivre un flux\u00A0: chaque heure, chaque article nouveau ou modifié est lu et daté\u00A0; rend l’identifiant du flux et son jeton',
			editeur: 'le registre public d’un flux\u00A0: chaque version datée, sans adresse ni titre\u00A0; avec <code>#&lt;jeton&gt;</code>, les adresses et les reçus',
			fluxPrive: 'le registre privé d’un flux, <code>authorization: Bearer &lt;jeton&gt;</code>',
			fluxRetire: 'cesser de suivre un flux, <code>authorization: Bearer &lt;jeton&gt;</code>\u00A0; les dates déjà enregistrées restent',
			plafond: `20 dépôts par jour et par adresse, 2${NBSP}000 par jour, <code>retry-after</code> jusqu’à minuit UTC`,
			unJour: 'une même adresse en ligne lue une fois par jour',
			illisible: 'lecture impossible\u00A0: 20 Mo, 30 s, 5 redirections au plus, adresses publiques seulement'
		},
		lire: {
			jour: 'les dépôts du jour, une ligne <code>{"sha256","jour","place","recu"}</code> par dépôt',
			recu: 'la page d’un reçu',
			ligneDuRecu: 'la ligne publique d’un reçu',
			depotsDeLEmpreinte: 'les dépôts d’une empreinte',
			collectivite: 'les actes d’une commune lus sur son site officiel\u00A0: date, nature, empreinte, reçu\u00A0; le SIREN y renvoie',
			communes: 'le nom de chaque commune, code INSEE ou SIREN vers <code>[nom, INSEE, SIREN]</code>',
			sites: 'les sites officiels des communes, code INSEE ou SIREN vers <code>[hôte, préfixe]</code>, d’après l’annuaire Service-Public',
			bilan: 'dépôts et déposants distincts, jour par jour',
			tours: 'les tours du registre',
			releve: 'le relevé d’un tour, avec <code>.racine</code>, <code>.racine.ots</code>, <code>.racine.tsr</code>',
			depots: 'les dépôts lus par l’entrepôt, dans l’ordre de leur inscription',
			sante: 'l’état du registre publié'
		},
		verifier: {
			feuille: ['feuille'],
			arbre: ['arbre', 'Merkle SHA-256 sur les octets des deux enfants\u00A0; un niveau impair double son dernier nœud'],
			racine: ['racine', '\u00A0; le premier tour suit 64 zéros'],
			depots: ['depots:&lt;n&gt;', 'la feuille des dépôts\u00A0: <code>sha256</code> des <code>n</code> premières lignes de <code>depots.jsonl</code>, chacune suivie de <code>"\\n"</code>'],
			recu: ['reçu', 'identifiant\u00A0: <code>sha256</code> de sa forme canonique, clés triées, sans espace'],
			bitcoin: ['Bitcoin'],
			script: ['script']
		}
	},
	mentions: {
		description: (marque) => `Éditeur, hébergeur et données conservées par ${marque}.`,
		sections: [
			['Éditeur', `<a href="https://florianmousseau.com">Florian Mousseau</a>, directeur de la publication. Contact${NBSP}: <a href="mailto:contact@florianmousseau.com">contact@florianmousseau.com</a>`],
			['Hébergeur', 'Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, États-Unis.'],
			[
				'Données',
				`Aucun document n’est reçu ni conservé, seulement son empreinte. Le libellé et l’adresse d’un dépôt restent dans le reçu. L’adresse IP d’un déposant n’est jamais écrite${NBSP}: seul son haché salé du jour sert au plafond, et le sel est effacé le lendemain. Aucun cookie.`
			]
		],
		code: 'Code'
	},
	llms: `# Témoin public

> Service gratuit, sans compte, qui prouve qu'un document existait à une date sans modification. Seule l'empreinte SHA-256 du document est publiée, jamais le document. Le registre est public, chaîné et ancré dans Bitcoin par OpenTimestamps.

- Dater un document : https://temoinpublic.fr/deposer (empreinte calculée dans le navigateur, ou adresse publique lue par le service ; un lien sur le site officiel d’une commune propose d’en faire un acte)
- Dater la mise en ligne d’un acte de collectivité (délibération, arrêté, décision), lu à son adresse : https://temoinpublic.fr/acte
- Vérifier un document ou un reçu : https://temoinpublic.fr/verifier
- Registre public des dates : https://temoinpublic.fr/journal
- API et formules de vérification sans le site : https://temoinpublic.fr/documentation
- Code source et miroir du registre : https://github.com/florianmousseau/empreintes
`
};
