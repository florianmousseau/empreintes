// Ce que la documentation montre dans toute langue : les adresses de l'API et les
// formules. Chaque edition n'en donne que l'explication, sous la meme cle ; une
// adresse qu'une edition ne nomme pas (les actes, en allemand) ne s'y affiche pas.

export const ADRESSES = {
	dater: [
		['empreinte', 'POST /api/depots {"sha256": "&lt;64 hex&gt;", "libelle": "&lt;texte&gt;"}'],
		['url', 'POST /api/depots {"url": "https://&lt;adresse&gt;"}'],
		['acte', 'POST /api/depots {"type": "acte", "url": "https://&lt;adresse&gt;", "collectivite": "&lt;INSEE | SIREN&gt;", "nature": "deliberation | arrete | decision", "libelle": "&lt;objet&gt;"}'],
		['cree', '201'],
		['flux', 'POST /api/flux {"url": "https://&lt;flux RSS ou Atom&gt;"}'],
		['editeur', 'GET /editeur/&lt;id&gt;'],
		['fluxPrive', 'GET /api/flux/&lt;id&gt;'],
		['fluxRetire', 'DELETE /api/flux/&lt;id&gt;'],
		['plafond', '429'],
		['unJour', '409'],
		['illisible', '422']
	],
	agents: [
		['mcp', 'POST /mcp'],
		['openapi', 'GET /openapi.json']
	],
	lire: [
		['jour', 'GET /depots/&lt;jour&gt;.jsonl'],
		['recu', 'GET /recu/&lt;id&gt;'],
		['ligneDuRecu', 'GET /api/recus/&lt;id&gt;'],
		['depotsDeLEmpreinte', 'GET /api/depots/&lt;sha256&gt;'],
		['collectivite', 'GET /collectivite/&lt;INSEE&gt;'],
		['communes', 'GET /annuaire/communes/insee-&lt;département&gt;.json'],
		['sites', 'GET /annuaire/insee-&lt;département&gt;.json'],
		['bilan', 'GET /api/bilan'],
		['tours', 'GET /tours.json'],
		['releve', 'GET /empreintes/&lt;tour&gt;.json'],
		['depots', 'GET /empreintes/depots.jsonl'],
		['sante', 'GET /health']
	]
};

/** Les formules, dans l'ordre de la table ; vide quand la ligne n'est qu'une explication. */
export const FORMULES = {
	feuille: '<code>sha256(cle + "\\n" + sha256 + "\\n" + jour + "\\n")</code>',
	arbre: '',
	racine: '<code>sha256("entrepot\\n" + tour + "\\n" + précédente + "\\n" + arbre + "\\n")</code>',
	depots: '',
	recu: '',
	bitcoin: '<code>ots verify &lt;tour&gt;.racine.ots</code>',
	script: '<a href="https://github.com/temoinpublic/empreintes/blob/main/scripts/verifier.mjs">node scripts/verifier.mjs &lt;document | --chaine&gt;</a>'
};
