import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { nommeUnePersonne, personnel } from '../src/personne.mjs';

// Repris de truecopydev/corpus (verite, politesse, murparmur) : le controle porte ses preuves avec lui.
describe('the person check, as the corpus holds it', () => {
	it('sees a title followed by a name', () => {
		assert.equal(personnel('Remuneration de M. Dupont | 1 200'), true);
		assert.equal(personnel('Mme Martin, directrice generale'), true);
		assert.equal(personnel('Compenso del Dott. Rossi'), true);
		assert.equal(personnel('Remuneration of Mr Smith'), true);
		assert.equal(personnel('Resultat net | Mmes et MM. les actionnaires'), false);
		assert.equal(personnel('Chiffre d affaires | 1 234'), false);
		// the letter of a Spanish balance-sheet heading is not a Don
		assert.equal(personnel('D. Pasivo corriente | 1.234'), false);
	});

	it('sees a first name followed by a name, and not the words of a statement', () => {
		assert.equal(nommeUnePersonne('Sarah Sisombat Gérante de la SCPI'), true);
		assert.equal(nommeUnePersonne('Giuseppe Verdi, Amministratore Delegato'), true);
		assert.equal(nommeUnePersonne('Lars Andersen, CEO'), true);
		assert.equal(nommeUnePersonne('Marie SOUCLIER, Presidente'), true);
		assert.equal(nommeUnePersonne('Per Share Data | 1.20'), false);
		assert.equal(nommeUnePersonne('Jan Feb Mar | 12 | 14'), false);
	});

	it('does not take a street, a compound place or a company named after a founder for a person', () => {
		assert.equal(nommeUnePersonne('12 rue Jean Jaures, 75010 Paris'), false);
		assert.equal(nommeUnePersonne('Epargne Pierre, Saint-Martin Bureaux'), false);
		assert.equal(nommeUnePersonne('Scission partielle de Louis Hachette Group ( 1 198 )'), false);
		assert.equal(nommeUnePersonne('Christian Dior SE | 1 234'), false);
		assert.equal(nommeUnePersonne('Christian Dior, administrateur'), true);
	});

	it('refuses a plural street name, which costs a few PLU pieces and is accepted', () => {
		// The check is conservative: "les rues Georges Mandel et ..." is refused, never guessed.
		assert.equal(nommeUnePersonne('le long des rues Georges Mandel et Francois'), true);
	});
});
