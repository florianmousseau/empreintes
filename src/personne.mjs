/*
 * LE CONTROLE DES PERSONNES (D-160), troisieme copie : truecopydev/corpus
 * (src/verite.mjs, commit f85478eae5be) l'a ecrit, florianmousseau/verites
 * (src/personne.mjs) et ce depot le portent sans y toucher une lettre. Les trois
 * copies ne divergent que par une correction portee des trois cotes, tests
 * compris. Ici, il refuse le libelle d'un acte de collectivite (D-165).
 */

/*
 * Les civilites des langues des rapports ESEF glanes : francais, anglais,
 * allemand, italien, espagnol, portugais, neerlandais, polonais, et les titres
 * qui precedent un nom partout (Dr, Prof.). « D. » (Don) n'y est pas : c'est la
 * lettre d'une rubrique dans un bilan espagnol (« D. Pasivo corriente »).
 */
const CIVILITES = [
	'M\\.', 'MM\\.', 'Mme', 'Mmes', 'Mlle', 'Monsieur', 'Madame',
	'Mr\\.?', 'Mrs\\.?', 'Ms\\.?', 'Miss', 'Sir', 'Dame', 'Dr\\.?', 'Prof\\.?',
	'Herr', 'Herrn', 'Frau',
	'Sig\\.', 'Sig\\.ra', 'Sig\\.a', 'Signor', 'Signora', 'Dott\\.', 'Dott\\.ssa', 'Avv\\.', 'Ing\\.',
	'Sr\\.', 'Sra\\.', 'Srta\\.', 'Don', 'Doña', 'Dña\\.', 'Dª',
	'Dhr\\.', 'Mevr\\.', 'Mw\\.',
	'Pan', 'Pani'
];
const CIVILITE = new RegExp(String.raw`(?:^|[\s|(])(?:${CIVILITES.join('|')})\s+[A-ZÀ-ÞŁŚŻŹĆŃ]`, 'u');

/**
 * Une civilite suivie d'un nom : le tableau parle d'une personne. Refuse a
 * l'entree du corpus, meme quand le document est public - D-111 ne glane que ce
 * qui ne porte aucune donnee personnelle d'un tiers.
 */
export function personnel(texte) {
	return CIVILITE.test(texte);
}

/*
 * UN NOM SANS CIVILITE : « Marie SOUCLIER, President ». Un bulletin de SCPI
 * signe son editorial ainsi, et `personnel` ne le voit pas. On cherche un prenom
 * courant suivi d'un mot a majuscule, hors d'une adresse (« rue Jean Jaures ») et
 * hors d'un nom compose (« Saint-Martin »). « Pierre » n'y est pas : c'est le mot
 * de la moitie des SCPI (« Epargne Pierre »). Liste, donc incomplete : un nom rare
 * passe, et c'est dit au protocole.
 */
const PRENOMS = [
	'Adrien', 'Alain', 'Alexandre', 'Alexandra', 'Alice', 'Amandine', 'Amelie', 'Amélie', 'Anne', 'Antoine', 'Arnaud', 'Aude', 'Audrey', 'Aurelie', 'Aurélie', 'Axel',
	'Baptiste', 'Benjamin', 'Benoit', 'Benoît', 'Bernard', 'Bertrand', 'Bruno', 'Camille', 'Caroline', 'Catherine', 'Cécile', 'Cecile', 'Cédric', 'Cedric', 'Céline', 'Celine',
	'Charles', 'Charlotte', 'Christian', 'Christine', 'Christophe', 'Claire', 'Claude', 'Clément', 'Clement', 'Corinne', 'Cyril', 'Damien', 'Daniel', 'David', 'Delphine', 'Denis',
	'Didier', 'Dominique', 'Édouard', 'Edouard', 'Élise', 'Elise', 'Emilie', 'Émilie', 'Emmanuel', 'Emmanuelle', 'Eric', 'Éric', 'Estelle', 'Étienne', 'Etienne', 'Fabien', 'Fabrice',
	'Florence', 'Florent', 'Florian', 'Franck', 'François', 'Francois', 'Françoise', 'Frédéric', 'Frederic', 'Gabriel', 'Gaël', 'Gaelle', 'Gaëlle', 'Georges', 'Gérard', 'Gilles',
	'Grégoire', 'Gregoire', 'Grégory', 'Guillaume', 'Hélène', 'Helene', 'Henri', 'Hervé', 'Herve', 'Hugo', 'Hugues', 'Isabelle', 'Jacques', 'Jean', 'Jean-Christophe', 'Jean-Claude',
	'Jean-François', 'Jean-Luc', 'Jean-Marc', 'Jean-Michel', 'Jean-Philippe', 'Jean-Pierre', 'Jérémie', 'Jérôme', 'Jerome', 'Joël', 'Johann', 'Jonathan', 'Joseph', 'Julie', 'Julien',
	'Justine', 'Karine', 'Laetitia', 'Laure', 'Laurence', 'Laurent', 'Léa', 'Lionel', 'Louis', 'Luc', 'Lucas', 'Lucie', 'Ludovic', 'Magali', 'Manuel', 'Marc', 'Marie', 'Marie-Christine',
	'Marine', 'Marion', 'Martin', 'Martine', 'Mathieu', 'Matthieu', 'Maxime', 'Mélanie', 'Michel', 'Michèle', 'Mickaël', 'Nathalie', 'Nicolas', 'Olivier', 'Pascal', 'Pascale',
	'Patrick', 'Paul', 'Philippe', 'Pierre-Yves', 'Quentin', 'Raphaël', 'Raphael', 'Rémi', 'Rémy', 'Remy', 'Renaud', 'Richard', 'Robert', 'Romain', 'Sabine', 'Samuel', 'Sandrine',
	'Sébastien', 'Sebastien', 'Serge', 'Sophie', 'Stéphane', 'Stephane', 'Stéphanie', 'Steven', 'Sylvain', 'Sylvie', 'Thibault', 'Thibaut', 'Thierry', 'Thomas', 'Timothée', 'Valérie',
	'Valerie', 'Vincent', 'Virginie', 'Xavier', 'Yann', 'Yannick', 'Yves',
	// Les prenoms courants des autres pays des rapports ESEF glanes. Ecartes parce
	// qu'ils sont aussi des mots d'un etat financier ou des lieux : Jan (janvier),
	// Per (« Per share »), Mark, Grant, Grace, Frank, Pilar (« Pilar II »), Mercedes,
	// Santiago, Victoria, Virginia, Jordan, Eva (EVA), Tim, Bas (Pays-Bas).
	// anglais
	'James', 'John', 'Michael', 'William', 'Joseph', 'Christopher', 'Matthew', 'Anthony', 'Donald', 'Steven', 'Andrew', 'Joshua', 'Kenneth',
	'Kevin', 'Brian', 'George', 'Timothy', 'Ronald', 'Edward', 'Jason', 'Jeffrey', 'Ryan', 'Jacob', 'Gary', 'Nicholas', 'Jonathan',
	'Stephen', 'Larry', 'Justin', 'Scott', 'Brandon', 'Gregory', 'Patrick', 'Jack', 'Dennis', 'Jerry', 'Aaron', 'Henry', 'Peter',
	'Douglas', 'Nathan', 'Walter', 'Harold', 'Jeremy', 'Carl', 'Keith', 'Roger', 'Gerald', 'Christian', 'Sean', 'Arthur', 'Lawrence',
	'Albert', 'Bruce', 'Alan', 'Philip', 'Russell', 'Mary', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan', 'Jessica', 'Sarah',
	'Karen', 'Lisa', 'Nancy', 'Margaret', 'Sandra', 'Emily', 'Michelle', 'Amanda', 'Melissa', 'Rebecca', 'Laura', 'Kathleen', 'Angela',
	'Helen', 'Katherine', 'Rachel', 'Heather', 'Diane', 'Ruth', 'Olivia', 'Kelly', 'Lauren', 'Christina', 'Megan', 'Andrea', 'Hannah',
	'Jacqueline', 'Teresa', 'Ann', 'Sara', 'Emma', 'Sophia', 'Natalie', 'Diana',
	// allemand
	'Hans', 'Klaus', 'Jürgen', 'Wolfgang', 'Andreas', 'Stefan', 'Markus', 'Matthias', 'Uwe', 'Dieter', 'Günter', 'Helmut', 'Werner',
	'Karl', 'Heinz', 'Gerhard', 'Manfred', 'Bernd', 'Ralf', 'Rainer', 'Jörg', 'Sven', 'Tobias', 'Sebastian', 'Maximilian', 'Lukas',
	'Dirk', 'Holger', 'Oliver', 'Carsten', 'Torsten', 'Volker', 'Joachim', 'Ulrich', 'Harald', 'Norbert', 'Johannes', 'Ursula',
	'Monika', 'Petra', 'Susanne', 'Claudia', 'Birgit', 'Karin', 'Gabriele', 'Renate', 'Heike', 'Stefanie', 'Katrin', 'Anja', 'Silke',
	'Kerstin', 'Brigitte',
	// italien
	'Giuseppe', 'Giovanni', 'Antonio', 'Mario', 'Luigi', 'Francesco', 'Vincenzo', 'Pietro', 'Salvatore', 'Carlo', 'Domenico', 'Paolo',
	'Michele', 'Giorgio', 'Sergio', 'Luciano', 'Alessandro', 'Marco', 'Luca', 'Stefano', 'Roberto', 'Massimo', 'Fabio', 'Matteo',
	'Lorenzo', 'Davide', 'Simone', 'Federico', 'Riccardo', 'Gianluca', 'Maurizio', 'Claudio', 'Enrico', 'Alberto', 'Maria', 'Anna',
	'Giovanna', 'Lucia', 'Caterina', 'Francesca', 'Chiara', 'Giulia', 'Valentina', 'Elena', 'Paola', 'Silvia', 'Federica', 'Alessandra',
	'Roberta', 'Simona', 'Cristina', 'Monica', 'Daniela',
	// espagnol et portugais
	'José', 'Manuel', 'Francisco', 'Juan', 'Javier', 'Jesús', 'Carlos', 'Miguel', 'Alejandro', 'Rafael', 'Pedro', 'Pablo', 'Ángel',
	'Fernando', 'Jorge', 'Luis', 'Álvaro', 'Diego', 'Raúl', 'Enrique', 'Ramón', 'Ignacio', 'Rubén', 'Óscar', 'Andrés', 'Joaquín',
	'Eduardo', 'Víctor', 'Jaime', 'Gonzalo', 'Iñigo', 'Borja', 'María', 'Carmen', 'Isabel', 'Dolores', 'Lucía', 'Marta', 'Paula',
	'Raquel', 'Beatriz', 'Nuria', 'Patricia', 'Ana', 'Montserrat', 'Inmaculada', 'Belén', 'João', 'António', 'Luís', 'Rui', 'Nuno',
	'Paulo', 'Tiago', 'Ricardo', 'Inês', 'Joana', 'Rita', 'Mariana', 'Catarina', 'Sofia',
	// neerlandais
	'Pieter', 'Hendrik', 'Cornelis', 'Willem', 'Gerrit', 'Jacobus', 'Kees', 'Henk', 'Joost', 'Ruud', 'Erik', 'Sander', 'Maarten',
	'Bart', 'Wouter', 'Joris', 'Thijs', 'Jeroen', 'Niels', 'Arjen', 'Johanna', 'Cornelia', 'Anneke', 'Ingrid', 'Marieke', 'Sanne',
	'Femke', 'Esther', 'Saskia', 'Mirjam',
	// nordiques
	'Lars', 'Anders', 'Johan', 'Nils', 'Mikael', 'Jonas', 'Henrik', 'Magnus', 'Fredrik', 'Mats', 'Björn', 'Gustav', 'Olof', 'Ole',
	'Søren', 'Jens', 'Morten', 'Rasmus', 'Mads', 'Kasper', 'Jesper', 'Mikkel', 'Jukka', 'Mikko', 'Timo', 'Matti', 'Pekka', 'Kari',
	'Juha', 'Antti', 'Heikki', 'Kristina', 'Birgitta', 'Mette', 'Hanne', 'Lene', 'Pia', 'Tiina', 'Päivi',
	// polonais
	'Piotr', 'Krzysztof', 'Andrzej', 'Tomasz', 'Paweł', 'Michał', 'Marcin', 'Grzegorz', 'Jakub', 'Adam', 'Łukasz', 'Mariusz',
	'Wojciech', 'Marek', 'Jacek', 'Zbigniew', 'Dariusz', 'Rafał', 'Katarzyna', 'Małgorzata', 'Agnieszka', 'Ewa', 'Krystyna',
	'Elżbieta', 'Magdalena', 'Joanna', 'Aleksandra', 'Beata'
];
/*
 * Un prenom suivi d'un nom PUIS d'une forme sociale est une societe, pas une
 * personne : « Louis Hachette Group », « Christian Dior SE ». Mesure du
 * 2026-09-30 : c'etait le seul des 642 tableaux ESEF que le controle des noms
 * refusait, a tort.
 */
const SOCIETE = /^[\s,]+(?:Group|Groupe|Gruppe|Gruppo|Grupo|Holdings?|SA|SE|SAS|SCA|AG|KGaA|GmbH|NV|N\.V\.|BV|B\.V\.|SpA|S\.p\.A\.|Srl|plc|PLC|Ltd|Limited|Inc|Corp|Corporation|Company|Foundation|Fondation|Fondazione|Stiftung|& ?Co|et Cie)\b/;
const VOIE = /(?:rue|avenue|av\.|boulevard|bd|place|quai|allée|allee|cours|impasse|chemin|square|route|esplanade|parc|centre|lycée|college|collège|hôpital|clinique)\s+(?:du\s+|de\s+la\s+|de\s+)?$/i;
const PRENOM_NOM = new RegExp(String.raw`(?<![\p{L}-])(${PRENOMS.join('|')})\s+(?:[A-Z]\.\s+)?(?:de\s+|d'|le\s+)?[A-ZÀ-Þ][\p{L}'-]+`, 'gu');

/** Vrai quand le texte nomme une personne : une civilite suivie d'un nom, ou un prenom courant suivi d'un nom, hors d'une adresse. */
export function nommeUnePersonne(texte) {
	if (personnel(texte)) return true;
	const t = String(texte);
	for (const m of t.matchAll(PRENOM_NOM)) {
		if (VOIE.test(t.slice(Math.max(0, m.index - 30), m.index))) continue;
		if (SOCIETE.test(t.slice(m.index + m[0].length, m.index + m[0].length + 20))) continue;
		return true;
	}
	return false;
}
