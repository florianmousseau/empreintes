// Les textes des scripts du navigateur, les deux langues cote a cote ; `T` les lit dans la langue de la page (`<html lang>`).
const NBSP = '\u00A0';

const bilingue = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && 'fr' in v && 'de' in v;
const vue = (noeud, langue) => (bilingue(noeud) ? noeud[langue] : Object.fromEntries(Object.entries(noeud).map(([k, v]) => [k, vue(v, langue)])));

const TEXTES = {
	hote: { fr: 'temoinpublic.fr', de: 'datumszeuge.de' },
	jour: { fr: (j) => (j ? j.split('-').reverse().join('/') : 'jour inconnu'), de: (j) => (j ? j.split('-').reverse().join('.') : 'Tag unbekannt') },
	heure: {
		fr: (id) => `${id.slice(6, 8)}/${id.slice(4, 6)}/${id.slice(0, 4)} ${id.slice(9, 11)}:${id.slice(11, 13)}${NBSP}UTC`,
		de: (id) => `${id.slice(6, 8)}.${id.slice(4, 6)}.${id.slice(0, 4)} ${id.slice(9, 11)}:${id.slice(11, 13)}${NBSP}UTC`
	},
	instant: {
		fr: (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} ${iso.slice(11, 16)}${NBSP}UTC`,
		de: (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)} ${iso.slice(11, 16)}${NBSP}UTC`
	},
	aucunDocument: { fr: 'Aucun document choisi', de: 'Kein Dokument ausgewählt' },
	choisir: { fr: 'Choisir le document.', de: 'Bitte ein Dokument auswählen.' },
	erreur: { fr: 'Erreur', de: 'Fehler' },
	erreurAvec: { fr: (m) => `Erreur${NBSP}: ${m}`, de: (m) => `Fehler: ${m}` },
	voirLeRecu: { fr: 'Voir le reçu', de: 'Beleg ansehen' },
	bloc: { fr: (b) => `Bitcoin, bloc ${b}`, de: (b) => `Bitcoin, Block ${b}` },
	calendrier: { fr: 'en cours d’inscription dans Bitcoin', de: 'Eintragung in Bitcoin läuft' },
	aucun: { fr: 'aucun', de: 'keine' },
	deposer: {
		deja: { fr: (j) => `Déjà daté le ${j}.`, de: (j) => `Bereits datiert am ${j}.` },
		refus: {
			400: { fr: 'Dépôt refusé', de: 'Hinterlegung abgelehnt' },
			409: { fr: 'Ce document en ligne a déjà été lu aujourd’hui', de: 'Dieses Dokument wurde heute schon gelesen' },
			422: { fr: 'Le document en ligne n’a pas pu être lu', de: 'Das Dokument konnte nicht gelesen werden' },
			429: { fr: 'Limite du jour atteinte, à demain', de: 'Tageslimit erreicht, bis morgen' }
		},
		motifs: {
			'url illisible': { fr: 'Ce lien n’est pas une adresse web.', de: 'Dieser Link ist keine Webadresse.' },
			'http ou https seulement': { fr: 'Le lien doit commencer par https:// ou http://.', de: 'Der Link muss mit https:// oder http:// beginnen.' },
			'adresse privee, locale ou reservee': { fr: 'Seules les adresses publiques sont acceptées.', de: 'Nur öffentliche Adressen sind zulässig.' },
			'nom d hote non public': { fr: 'Seules les adresses publiques sont acceptées.', de: 'Nur öffentliche Adressen sind zulässig.' },
			'hote sans adresse': { fr: 'Ce site n’existe pas.', de: 'Diese Website existiert nicht.' },
			'sha256 : 64 caracteres hexadecimaux': { fr: 'Une empreinte SHA-256 compte 64 caractères, chiffres et lettres de a à f.', de: 'Eine SHA-256-Prüfsumme hat 64 Zeichen, Ziffern und Buchstaben von a bis f.' },
			'collectivite : code commune INSEE (5 caracteres) ou SIREN (9 chiffres)': { fr: 'Le code INSEE de la commune a 5 caractères, le SIREN de la collectivité 9 chiffres.', de: 'Der INSEE-Code der Gemeinde hat 5 Zeichen, die SIREN der Körperschaft 9 Ziffern.' },
			'libelle : aucun nom de personne': { fr: 'Le nom ou l’objet ne doit nommer personne.', de: 'Name oder Gegenstand dürfen keine Person nennen.' }
		},
		commune: { fr: (insee) => `la commune ${insee}`, de: (insee) => `Gemeinde ${insee}` },
		daterActe: { fr: 'Dater cet acte', de: 'Diesen Rechtsakt datieren' },
		daterDocument: { fr: 'Dater ce document', de: 'Dieses Dokument datieren' },
		natures: { deliberation: { fr: 'Délibération', de: 'Beschluss' }, arrete: { fr: 'Arrêté', de: 'Verfügung' }, decision: { fr: 'Décision', de: 'Entscheidung' } },
		rattachement: { 'site-officiel': { fr: 'adresse sur son site officiel', de: 'Adresse auf ihrer offiziellen Website' }, declaree: { fr: 'déclarée', de: 'angegeben' } },
		collectivite: { fr: 'Collectivité', de: 'Gebietskörperschaft' },
		luA: { fr: 'lu à', de: 'gelesen unter' },
		calculee: { fr: 'calculée sur votre appareil', de: 'auf Ihrem Gerät berechnet' },
		recuActe: { fr: (nature, j, h) => `${nature} en ligne le ${j}, ${h}${NBSP}UTC`, de: (nature, j, h) => `${nature} online am ${j}, ${h}${NBSP}UTC` },
		recuDocument: { fr: (j) => `Document daté du ${j}`, de: (j) => `Dokument datiert am ${j}` },
		enLigne: { fr: 'Ce fichier était en ligne à cette adresse à cet instant.', de: 'Diese Datei war in diesem Moment unter dieser Adresse online.' },
		gardez: {
			fr: `Gardez ce reçu avec le document${NBSP}: ensemble, ils prouvent qu’il existait ce jour-là, sans modification.`,
			de: 'Bewahren Sie diesen Beleg zusammen mit dem Dokument auf: Gemeinsam beweisen sie, dass es an diesem Tag unverändert existiert hat.'
		},
		imprimer: { fr: 'Imprimer le reçu', de: 'Beleg drucken' },
		telecharger: { fr: 'Télécharger le reçu', de: 'Beleg herunterladen' },
		nom: { fr: 'Nom', de: 'Name' },
		empreinte: { fr: 'Empreinte', de: 'Prüfsumme' },
		ligne: { fr: 'Entrée publique', de: 'Öffentlicher Eintrag' },
		place: { fr: (place, j) => `n°${NBSP}${place} du ${j}`, de: (place, j) => `Nr.${NBSP}${place} vom ${j}` },
		emis: { fr: 'Émis', de: 'Ausgestellt' },
		instant: { fr: (j, h) => `le ${j} à ${h}${NBSP}UTC`, de: (j, h) => `am ${j} um ${h}${NBSP}UTC` },
		adresse: { fr: 'Adresse', de: 'Adresse' },
		fichier: { fr: 'recu', de: 'beleg' }
	},
	verifier: {
		preuveOts: { fr: 'preuve .ots', de: 'Beweis .ots' },
		horodatageTsr: { fr: 'horodatage .tsr', de: 'Zeitstempel .tsr' },
		identique: { fr: (j) => `Identique au document daté du ${j}`, de: (j) => `Identisch mit dem am ${j} datierten Dokument` },
		nonConforme: { fr: 'Preuve non conforme', de: 'Beweis nicht gültig' },
		details: { fr: 'Détails de la preuve', de: 'Details des Beweises' },
		objet: { fr: 'Objet', de: 'Objekt' },
		vu: { fr: 'Vu', de: 'Gesehen' },
		duTourAu: { fr: (a, b) => `du tour ${a} au tour ${b}`, de: (a, b) => `von Runde ${a} bis Runde ${b}` },
		chemin: { fr: 'Chemin d’audit', de: 'Prüfpfad' },
		etapes: { fr: (n) => `${n} étapes, racine recalculée`, de: (n) => `${n} Schritte, Wurzel nachgerechnet` },
		absent: { fr: 'absent du relevé', de: 'nicht im Protokoll' },
		racine: { fr: 'Racine du tour', de: 'Wurzel der Runde' },
		jamais: { fr: 'Ce document n’a jamais été daté ici', de: 'Dieses Dokument wurde hier nie datiert' },
		authentique: { fr: (j) => `Reçu authentique${NBSP}: document daté du ${j}`, de: (j) => `Echter Beleg: Dokument datiert am ${j}` },
		inconnu: { fr: 'Reçu inconnu', de: 'Unbekannter Beleg' },
		tour: { fr: (h) => `Tour ${h}`, de: (h) => `Runde ${h}` },
		intacte: { fr: (n) => `Chaîne intacte, ${n} tours`, de: (n) => `Kette intakt, ${n} Runden` },
		derniere: { fr: `Dernière racine${NBSP}:`, de: 'Letzte Wurzel:' },
		rompue: { fr: 'Chaîne rompue', de: 'Kette unterbrochen' },
		signature: { fr: 'Signature du journal', de: 'Signatur des Journals' },
		signatureValide: { fr: 'valide', de: 'gültig' },
		signatureNonConforme: { fr: 'non conforme', de: 'ungültig' },
		signeePar: { fr: 'Signé par', de: 'Signiert von' },
		signeeValide: { fr: (sujet, emetteur) => `${sujet}, certificat émis par ${emetteur}${NBSP}: signature valide`, de: (sujet, emetteur) => `${sujet}, Zertifikat ausgestellt von ${emetteur}: Signatur gültig` },
		signeeNonConforme: { fr: 'signature non conforme', de: 'Signatur ungültig' },
		sansNom: { fr: 'certificat sans nom', de: 'Zertifikat ohne Namen' },
		autorite: { fr: 'Autorité', de: 'Aussteller' },
		inscrite: { fr: (nom, pays) => `${nom}, inscrite sur la liste de confiance européenne (${pays})`, de: (nom, pays) => `${nom}, eingetragen in der europäischen Vertrauensliste (${pays})` },
		signatures: { fr: (n) => `${n} signatures du journal valides`, de: (n) => `${n} gültige Signaturen des Journals` },
		horodatage: { fr: 'Horodatage eIDAS', de: 'eIDAS-Zeitstempel' },
		horodatageValide: { fr: (h) => `valide, ${h}`, de: (h) => `gültig, ${h}` },
		horodatages: { fr: (n) => `${n} horodatages eIDAS valides`, de: (n) => `${n} gültige eIDAS-Zeitstempel` }
	},
	recu: {
		inscrit: { fr: (h) => `inscrit le ${h}`, de: (h) => `eingetragen am ${h}` },
		attente: { fr: 'en attente d’inscription', de: 'Eintragung steht aus' },
		nonConforme: { fr: 'preuve non conforme', de: 'Beweis nicht gültig' },
		illisible: { fr: 'registre illisible pour le moment', de: 'Register im Moment nicht lesbar' }
	},
	editeur: {
		flux: { fr: `Flux${NBSP}: `, de: 'Feed: ' },
		telecharger: { fr: 'Télécharger les reçus', de: 'Belege herunterladen' },
		cesser: { fr: 'Cesser de suivre ce flux', de: 'Diesen Feed nicht mehr verfolgen' },
		confirmer: { fr: `Cesser de suivre ce flux${NBSP}? Les dates déjà enregistrées restent.`, de: 'Diesen Feed nicht mehr verfolgen? Die bereits eingetragenen Datierungen bleiben.' },
		articles: { fr: 'Vos articles', de: 'Ihre Artikel' },
		refuse: { fr: 'Lien privé refusé.', de: 'Privater Link abgelehnt.' },
		fichier: { fr: 'recus', de: 'belege' }
	}
};

export const T = vue(TEXTES, document.documentElement.lang === 'de' ? 'de' : 'fr');
