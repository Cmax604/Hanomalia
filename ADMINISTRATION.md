# Administration de la V2

Adresse : https://cmax604.github.io/Hanomalia/admin/

## Source de vérité

- `content/site.json` contient les textes, images, liens, produits et albums.
- `data-cms-text`, `data-cms-image` et `data-cms-url` relient chaque page à ses champs.
- `scripts/build-site.mjs` valide le document et produit `site-data.js` au déploiement.
- `site-render.js` applique les contenus aux pages, puis expose les collections à `collections.js`.
- `collections-data.js` est désormais un adaptateur ; modifier les collections dans `content/site.json`.

Pour travailler localement : `node scripts/build-site.mjs --data-only`, puis servir le dossier avec un serveur HTTP. `node scripts/build-site.mjs` prépare `_site/`.

## Connexion

L’interface publique utilise une clé personnelle GitHub fine-grained limitée à `Cmax604/Hanomalia`, permission Contents Read and write. Aucun secret n’est embarqué. La clé n’est conservée qu’en mémoire, jamais dans les brouillons, sauvegardes, URLs ou commits. Le contrôle des droits de publication est effectué par GitHub.

Cette version n’utilise pas OAuth : il n’y a pas de serveur d’authentification ou d’abonnement supplémentaire. Le propriétaire crée sa clé dans GitHub ; aucun token ne doit être communiqué à l’agent. `admin/guide.html` détaille la configuration.

## Brouillons et aperçu

Les brouillons et nouvelles images sont stockés dans IndexedDB sur l’appareil. Un export JSON conserve les deux. La prévisualisation utilise une iframe du même site, un document de brouillon dans sessionStorage et des URLs blob pour les images non publiées. Aucun secret n’est transmis à la prévisualisation. Les URLs de prévisualisation ne publient aucun contenu.

## Publication et conflits

La publication vérifie le SHA du fichier `content/site.json` avant les écritures. Elle crée les blobs, un arbre et un commit, puis avance `main` sans force. Si le contenu a changé ou si une écriture concurrente rend le commit non fast-forward, le brouillon reste intact et l’utilisateur recharge après export. Les assets et leur document sont publiés dans le même commit.

Le workflow Pages compile la source de vérité et déploie la V2. Le dépôt officiel `Cmax604/Hanomalia_Band` est absent de toute destination d’écriture.

## Vérifications

`node --test tests/admin.test.mjs` vérifie les validations, l’encodage Unicode, les références média, le refus des conflits et les écritures Git atomiques avec un serveur simulé.
