# empreintes

Le journal public des empreintes de l'entrepot : chaque tour, le SHA-256 de
chaque fichier archive, assemble en arbre de Merkle, chaine au tour precedent
et ancre dans Bitcoin par OpenTimestamps. Aucun contenu, seulement des
empreintes.

https://temoinpublic.fr (Temoin public ; l'ancienne adresse
empreintes.florianmousseau.com redirige ses pages, son API reste servie).

- `donnees/empreintes/` : le miroir du journal (releves, racines, preuves
  `.ots`, horodatages `.tsr`, `ancrages.json`), pousse par l'entrepot.
- `/verifier` : un fichier ou une empreinte, et la chaine des racines.

```sh
node scripts/verifier.mjs <fichier|sha256>   # servi tel quel, et quand
node scripts/verifier.mjs --chaine           # la chaine de bout en bout
ots verify donnees/empreintes/<tour>.racine.ots   # l'ancrage Bitcoin
```

Le verificateur (`src/chaine.mjs`) est ecrit a part du code qui produit le
journal, sans dependance, et tourne dans le navigateur comme sous Node.
