// L'edition allemande : Datumszeuge, sur datumszeuge.de. Meme moteur, meme
// registre ; sans les actes de collectivite, qui sont francais.

const NBSP = '\u00A0';
const jour = (j) => j.split('-').reverse().join('.');
const pluriel = (n, un, plusieurs) => (n > 1 ? plusieurs : un);
const nombre = (n) => n.toLocaleString('de-DE');

export default {
	langue: 'de',
	locale: 'de_DE',
	hote: 'datumszeuge.de',
	adresse: 'https://datumszeuge.de',
	marque: 'Datumszeuge',
	avecActes: false,
	actes: {
		dater: { chemin: '/datieren', nom: 'Datieren', titre: 'Ein Dokument datieren' },
		verifier: { chemin: '/pruefen', nom: 'Prüfen', titre: 'Ein Dokument prüfen' },
		journal: { chemin: '/register', nom: 'Register', titre: 'Datumsregister' },
		documentation: { chemin: '/dokumentation', nom: 'Dokumentation', titre: 'Dokumentation' },
		mentions: { chemin: '/impressum', nom: 'Impressum', titre: 'Impressum' }
	},
	jour,
	dateHeure: (iso) => {
		const [j, h] = iso.split('T');
		return `${jour(j)} ${h.slice(0, 5)}${NBSP}UTC`;
	},
	nombre,
	structure: {
		description: 'Kostenlos beweisen, dass ein Dokument an einem bestimmten Tag unverändert existiert hat: seine Prüfsumme wird in ein öffentliches, in Bitcoin verankertes Register eingetragen.'
	},
	navigation: 'Hauptnavigation',
	codeSource: 'Quellcode',
	ancrage: { bitcoin: (bloc) => `Bitcoin, Block ${bloc}`, calendrier: 'Eintragung in Bitcoin läuft', aucun: 'keine' },
	fichiers: { json: 'Protokoll', racine: 'Wurzel', 'racine.ots': '.ots', 'racine.tsr': '.tsr' },
	zone: { glisser: 'Hierher ziehen oder ', choisir: 'auf Ihrem Gerät auswählen', aucun: 'Kein Dokument ausgewählt' },
	empreinte: { question: 'Eine SHA-256-Prüfsumme?', libelle: 'Die SHA-256-Prüfsumme' },
	formulaire: {
		deposez: 'Dokument zum Datieren hier ablegen',
		ou: 'oder',
		lien: 'Der Link zu einem Dokument im Internet',
		exemple: 'https://www.beispiel.de/vertrag.pdf',
		nommer: 'Einen Namen vergeben (optional)',
		nom: 'Name',
		bouton: 'Dieses Dokument datieren',
		recoit: 'Sie erhalten einen Beleg zum Ausdrucken oder Herunterladen, den Sie zusammen mit dem Dokument aufbewahren. Eine abgelegte Datei verlässt Ihr Gerät nie.'
	},
	etapes: [
		['Ablegen', 'Ein Angebot, ein Vertrag, ein Foto, ein PDF.'],
		['Beleg aufbewahren', 'Datiert, zum Ausdrucken, zusammen mit dem Dokument.'],
		['Prüfen', 'Jeder, jederzeit, ohne Konto.']
	],
	accueil: {
		titre: 'Das Datum eines Dokuments beweisen',
		description: 'Beweisen Sie kostenlos, dass ein Dokument an einem bestimmten Tag unverändert existiert hat. Ohne Konto; nur seine Prüfsumme wird veröffentlicht, nie das Dokument.',
		h1: 'Beweisen Sie, dass ein Dokument an einem Tag unverändert existiert hat.',
		chapeau: 'Kostenlos, ohne Konto. Für jeden nachprüfbar, auch ohne diese Website.',
		deja: 'Schon datiert?',
		compte: (n, j) => `${nombre(n)} Datierungen seit dem ${j}.`
	},
	journal: {
		description: 'Jede Runde des Prüfsummenregisters: Dokumente, verkettete Wurzel, Bitcoin-Verankerung, Beweisdateien.',
		sousTitre: 'Die öffentliche Liste der Datierungen, ohne die Dokumente.',
		chiffres: ['Dokumente', 'Runden', 'Seit dem'],
		derniereRacine: (dh) => `Letzte Wurzel, ${dh}`,
		verifierChaine: 'Kette prüfen',
		aucunTour: 'Noch keine Runde veröffentlicht.',
		tours: (n) => `${nombre(n)} Runden`,
		colonnes: ['Runde', 'Dokumente', 'Wurzel', 'Bitcoin', 'Dateien'],
		script: 'Prüfskript'
	},
	verifier: {
		description: 'Prüfen, ob ein Dokument mit dem datierten Dokument übereinstimmt, und an welchem Tag es datiert wurde.',
		deposez: 'Dokument oder Beleg hier ablegen',
		autrement: 'Datei nicht zur Hand?',
		bouton: 'Prüfen'
	},
	deposer: {
		description: 'Ein Dokument kostenlos datieren, in Bitcoin verankert, mit Beleg zum Ausdrucken. Nur seine Prüfsumme wird veröffentlicht, nie das Dokument.',
		compte: 'Kostenlos, ohne Konto, bis zu 20 Dokumente pro Tag. Rechtlich: ein Beweismittel, das das Gericht frei würdigt.'
	},
	recu: {
		titre: (j) => `Datumsbeleg vom ${j}`,
		description: (acte, j, place) => `Datumsbeleg: ${acte ? 'Dokument online' : 'Dokument datiert'} am ${j}, Zeile ${place}.`,
		h1: 'Datumsbeleg',
		enLigne: (j) => `Online am ${j}`,
		date: (j) => `Dokument datiert am ${j}`,
		acte: 'Rechtsakt',
		collectivite: 'Gebietskörperschaft',
		adresseCollectivite: (code) => `https://temoinpublic.fr/collectivite/${code}`,
		sansObjet: 'Ohne Gegenstand',
		natures: { deliberation: 'Beschluss', arrete: 'Verfügung', decision: 'Entscheidung' },
		empreinte: 'Prüfsumme',
		ligne: 'Zeile',
		place: (place, j) => `${place} vom ${j}`,
		registre: 'Register',
		lecture: 'Register wird gelesen',
		imprimer: 'Beleg drucken'
	},
	editeur: {
		titre: (id) => `Register des Herausgebers ${id}`,
		description: (id) => `Die datierten Versionen der Artikel des Feeds ${id}: Datum, Zeile im Register, Prüfsumme.`,
		h1: 'Register des Herausgebers',
		flux: (id, etat) => `Feed ${id}. ${etat}.`,
		suiviDepuis: (j) => `Verfolgt seit dem ${j}`,
		suiviDuAu: (a, b) => `Verfolgt vom ${a} bis ${b}`,
		colonnes: ['Artikel', 'Versionen', 'Datiert am', 'Zeile', 'Prüfsumme'],
		compte: (articles, versions) => `${nombre(versions)} ${pluriel(versions, 'Version', 'Versionen')}, ${nombre(articles)} Artikel`,
		aucune: 'Keine datierte Version',
		coupe: (montrees, total) => `Die ${nombre(montrees)} neuesten von ${nombre(total)}.`
	},
	recuInconnu: { titre: 'Unbekannter Beleg', description: 'Kein Eintrag trägt diesen Beleg.' },
	introuvable: { titre: 'Seite nicht gefunden', description: 'Unter dieser Adresse gibt es keine Seite.' },
	documentation: {
		description: 'Adressen, Grenzen und Formeln des Datumsregisters: datieren, lesen und ohne diese Website prüfen.',
		dater: [
			'Datieren',
			['POST /api/depots {"sha256": "&lt;64 hex&gt;", "libelle": "&lt;Text&gt;"}', 'eine von Ihnen berechnete Prüfsumme; der Name bleibt im Beleg'],
			['POST /api/depots {"url": "https://&lt;Adresse&gt;"}', 'der Dienst liest das Dokument selbst im Internet und datiert seine Bytes'],
			['201', 'der Beleg, seine Kennung, die öffentliche Zeile'],
			['POST /api/flux {"url": "https://&lt;RSS- oder Atom-Feed&gt;"}', 'einen Feed verfolgen: jede Stunde wird jeder neue oder geänderte Artikel gelesen und datiert; gibt die Kennung des Feeds und sein Token zurück'],
			['GET /editeur/&lt;id&gt;', 'das öffentliche Register eines Feeds: jede datierte Version, ohne Adresse und Titel; mit <code>#&lt;Token&gt;</code> auch die Adressen und Belege'],
			['GET /api/flux/&lt;id&gt;', 'das private Register eines Feeds, <code>authorization: Bearer &lt;Token&gt;</code>'],
			['DELETE /api/flux/&lt;id&gt;', 'einen Feed nicht mehr verfolgen, <code>authorization: Bearer &lt;Token&gt;</code>; die bereits eingetragenen Datierungen bleiben'],
			['429', '20 Datierungen pro Tag und Adresse, 2.000 pro Tag, <code>retry-after</code> bis Mitternacht UTC'],
			['409', 'dieselbe Internetadresse wird einmal pro Tag gelesen'],
			['422', 'Lesen nicht möglich: höchstens 20 MB, 30 s, 5 Weiterleitungen, nur öffentliche Adressen']
		],
		lire: [
			'Lesen',
			['GET /depots/&lt;Tag&gt;.jsonl', 'die Datierungen des Tages, eine Zeile <code>{"sha256","jour","place","recu"}</code> je Datierung'],
			['GET /recu/&lt;id&gt;', 'die Seite eines Belegs'],
			['GET /api/recus/&lt;id&gt;', 'die öffentliche Zeile eines Belegs'],
			['GET /api/depots/&lt;sha256&gt;', 'die Datierungen einer Prüfsumme'],
			['GET /api/bilan', 'Datierungen und verschiedene Einreicher, Tag für Tag'],
			['GET /tours.json', 'die Runden des Registers'],
			['GET /empreintes/&lt;Runde&gt;.json', 'das Protokoll einer Runde, mit <code>.racine</code>, <code>.racine.ots</code>, <code>.racine.tsr</code>'],
			['GET /empreintes/depots.jsonl', 'die vom Archiv gelesenen Datierungen, in der Reihenfolge ihrer Eintragung'],
			['GET /health', 'der Zustand des veröffentlichten Registers']
		],
		verifier: [
			'Ohne diese Website prüfen',
			['Blatt', '<code>sha256(cle + "\\n" + sha256 + "\\n" + jour + "\\n")</code>'],
			['Baum', 'Merkle-Baum, SHA-256 über die Bytes der beiden Kinder; eine ungerade Ebene verdoppelt ihren letzten Knoten'],
			['Wurzel', '<code>sha256("entrepot\\n" + Runde + "\\n" + vorige + "\\n" + Baum + "\\n")</code>; die erste Runde folgt auf 64 Nullen'],
			['depots:&lt;n&gt;', 'das Blatt der Datierungen: <code>sha256</code> der ersten <code>n</code> Zeilen von <code>depots.jsonl</code>, jede gefolgt von <code>"\\n"</code>'],
			['Beleg', 'Kennung: <code>sha256</code> seiner kanonischen Form, Schlüssel sortiert, ohne Leerzeichen'],
			['Bitcoin', '<code>ots verify &lt;Runde&gt;.racine.ots</code>'],
			['Skript', '<a href="https://github.com/florianmousseau/empreintes/blob/main/scripts/verifier.mjs">node scripts/verifier.mjs &lt;Dokument | --chaine&gt;</a>']
		]
	},
	mentions: {
		description: (marque) => `Anbieter, Hosting und gespeicherte Daten von ${marque}.`,
		sections: [
			['Anbieter', '<a href="https://florianmousseau.com">Florian Mousseau</a>. Kontakt: <a href="mailto:contact@florianmousseau.com">contact@florianmousseau.com</a>'],
			['Hosting', 'Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, USA.'],
			[
				'Datenschutz',
				'Es wird kein Dokument empfangen oder gespeichert, nur seine Prüfsumme. Name und Adresse einer Datierung bleiben im Beleg. Die IP-Adresse eines Einreichers wird nie gespeichert: nur ihr gesalzener Tageshash dient der Tagesgrenze, und das Salz wird am nächsten Tag gelöscht. Keine Cookies.'
			]
		],
		code: 'Quellcode'
	},
	llms: `# Datumszeuge

> Kostenloser Dienst ohne Konto, der beweist, dass ein Dokument an einem bestimmten Tag unverändert existiert hat. Nur die SHA-256-Prüfsumme des Dokuments wird veröffentlicht, nie das Dokument. Das Register ist öffentlich, verkettet und über OpenTimestamps in Bitcoin verankert.

- Ein Dokument datieren: https://datumszeuge.de/datieren (Prüfsumme im Browser berechnet, oder öffentliche Adresse, die der Dienst selbst liest)
- Ein Dokument oder einen Beleg prüfen: https://datumszeuge.de/pruefen
- Öffentliches Datumsregister: https://datumszeuge.de/register
- API und Formeln zur Prüfung ohne die Website: https://datumszeuge.de/dokumentation
- Quellcode und Spiegel des Registers: https://github.com/florianmousseau/empreintes
`
};
