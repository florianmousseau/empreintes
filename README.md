# empreintes

Le journal public des empreintes de l'entrepot : chaque tour, le SHA-256 de
chaque fichier archive, assemble en arbre de Merkle, chaine au tour precedent
et ancre dans Bitcoin par OpenTimestamps. Aucun contenu, seulement des
empreintes.

https://empreintes.florianmousseau.com

- `donnees/empreintes/` : le miroir du journal (releves, racines, preuves
  `.ots`, horodatages `.tsr`, `ancrages.json`), copie chaque heure.
- `/verifier` : un fichier ou une empreinte, et la chaine des racines.

```sh
node scripts/verifier.mjs <fichier|sha256>   # servi tel quel, et quand
node scripts/verifier.mjs --chaine           # la chaine de bout en bout
ots verify donnees/empreintes/<tour>.racine.ots   # l'ancrage Bitcoin
```

Le verificateur (`src/chaine.mjs`) est ecrit a part du code qui produit le
journal, sans dependance, et tourne dans le navigateur comme sous Node.
