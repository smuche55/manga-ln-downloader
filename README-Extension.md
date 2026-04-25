# Extension Chrome/Kiwi : Manga to Google Drive

Cette extension permet de télécharger directement les chapitres de mangas depuis votre navigateur (qui passe Cloudflare naturellement) pour les envoyer directement sur votre Google Drive au format `.cbz`.

## Étape 1 : Obtenir un "Client ID" Google Chrome

Pour que l'extension puisse se connecter à votre Drive, Google exige un identifiant spécifique aux extensions Chrome. L'identifiant que nous avions créé pour le script Python (Desktop App) ne fonctionnera pas ici.

1. Allez sur la [Google Cloud Console](https://console.cloud.google.com/).
2. Sélectionnez votre projet `LNMangaDL`.
3. Allez dans **APIs & Services** > **Credentials** (Identifiants).
4. Cliquez sur **+ CREATE CREDENTIALS** en haut, puis choisissez **OAuth client ID**.
5. Dans "Application type", choisissez **Chrome extension** (Extension Chrome).
6. Dans la case "Item ID" (ID d'application), mettez n'importe quelle chaîne aléatoire de 32 caractères pour l'instant (ex: `abcdefghijklmnopqrstuvwxyzabcdef`), nous n'avons pas besoin de la publier.
   *Note : Si Google exige un ID valide car vous chargez l'extension dézippée, Chrome génère un ID temporaire que vous pourrez voir sur la page des extensions.*
7. Cliquez sur **Create**.
8. Google va vous afficher votre nouveau **Client ID** (il ressemble à `123456789-xxxx.apps.googleusercontent.com`). **Copiez-le**.

## Étape 2 : Configurer l'extension

1. Ouvrez le fichier `manifest.json` qui se trouve dans le dossier de l'extension.
2. À la fin du fichier, trouvez la section `"oauth2"`.
3. Remplacez `"YOUR_CLIENT_ID_HERE.apps.googleusercontent.com"` par le Client ID que vous venez de copier.
4. Sauvegardez le fichier.

## Étape 3 : Installer l'extension sur PC (Chrome)

1. Ouvrez Google Chrome sur votre PC.
2. Allez à l'adresse : `chrome://extensions/`
3. En haut à droite, activez le **"Mode développeur"** (Developer mode).
4. Cliquez sur le bouton en haut à gauche **"Charger l'extension non empaquetée"** (Load unpacked).
5. Sélectionnez le dossier `chrome-extension` (celui qui contient le fichier `manifest.json`).
6. L'extension "Manga to Drive Downloader" apparaît maintenant dans votre liste !

## Étape 4 : Installer l'extension sur Android (Tablette/Smartphone)

1. Installez l'application **Kiwi Browser** depuis le Google Play Store.
2. Transférez le dossier de l'extension sur votre tablette.
3. Ouvrez Kiwi Browser, appuyez sur les 3 points en haut à droite > **Extensions**.
4. Activez le **"Mode développeur"** (Developer mode).
5. Appuyez sur **"+ From (.zip/ .crx/ .user.js)"**.
6. Sélectionnez le dossier de l'extension (ou zippez-le d'abord si Kiwi demande un zip).

## Utilisation

1. Naviguez normalement jusqu'à la page d'un chapitre de manga (ex: Scan-Manga ou Poseidon-Scans).
2. Si Cloudflare vous demande de cocher une case, faites-le (comme un utilisateur normal).
3. Une fois les images du chapitre affichées sur la page, cliquez sur l'icône de notre extension (le bouton bleu).
4. Appuyez sur le bouton **"1. Extraire et envoyer (.cbz)"**.
5. Lors de la première utilisation, une fenêtre Google apparaîtra pour vous demander l'autorisation de se connecter à votre Drive. Acceptez.
6. L'extension va alors aspirer les images, créer le CBZ, et l'envoyer sur Drive. Un message de succès s'affichera à la fin !
