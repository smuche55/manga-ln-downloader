# Manga & Light Novel to Google Drive Downloader

Ce projet permet de télécharger automatiquement des chapitres de Light Novels et de Mangas/Manhwas depuis différents sites pour les sauvegarder directement sur votre Google Drive.

## Fonctionnalités

*   **Light Novels** : Sauvegardés au format Google Docs (un document par chapitre) dans le dossier `Lecture/Light Novels/Nom_de_la_serie`.
*   **Mangas/Manhwas** : Sauvegardés au format `.cbz` (archive de toutes les images du chapitre) dans le dossier `Lecture/Mangas/Nom_de_la_serie`.
*   **Suivi de progression** : Le script mémorise les chapitres déjà téléchargés. Si vous le relancez avec le même lien, il ne téléchargera que les nouveaux chapitres.
*   **Contournement Anti-Bot** : Utilise Playwright (un navigateur web simulé) pour passer outre les protections de base comme Cloudflare.

## Prérequis

1.  Avoir **Python 3.8+** installé sur votre PC Windows.
2.  Avoir un compte Google et générer des identifiants API (voir la section "Configuration de Google Drive" ci-dessous).

## Installation

1.  Ouvrez un terminal (ou l'invite de commande) dans le dossier du projet.
2.  Installez les dépendances Python :
    ```bash
    pip install -r requirements.txt
    ```
3.  Installez les navigateurs requis par Playwright :
    ```bash
    playwright install chromium
    ```

## Configuration de Google Drive (Très important)

Pour que le script puisse créer des dossiers et des fichiers sur votre Google Drive, vous devez l'autoriser :

1.  Allez sur la [Google Cloud Console](https://console.cloud.google.com/).
2.  Créez un nouveau projet (ex: `MangaDownloader`).
3.  Allez dans **APIs & Services** > **Library**.
4.  Cherchez et activez **Google Drive API** et **Google Docs API**.
5.  Allez dans **APIs & Services** > **OAuth consent screen** et configurez-le (vous pouvez choisir "External" et ajouter votre adresse email en tant qu'utilisateur de test).
6.  Allez dans **APIs & Services** > **Credentials**.
7.  Cliquez sur **Create Credentials** > **OAuth client ID**.
8.  Choisissez "Desktop app" (Application de bureau) comme type d'application.
9.  Téléchargez le fichier JSON généré et renommez-le en **`credentials.json`**.
10. Placez ce fichier `credentials.json` à la **racine de ce projet** (à côté de `src/` et `requirements.txt`).

*Note : Lors du premier lancement du script, une page web s'ouvrira pour vous demander de vous connecter à votre compte Google et d'autoriser l'application. Cela va créer un fichier `token.json` qui permettra au script de se reconnecter automatiquement par la suite sans vous demander.*

## Utilisation

1.  Créez un fichier nommé **`links.txt`** à la racine du projet (le script le créera vide s'il n'existe pas).
2.  Dans ce fichier `links.txt`, collez les liens vers les pages de sommaire (Table of Contents) des séries que vous voulez sauvegarder, **un lien par ligne**.
    *Exemple:*
    ```text
    https://www.shmtranslations.com/ongoing/farming-life-in-another-world/
    https://poseidon-scans.net/serie/infinite-mage
    ```
3.  Lancez le script :
    ```bash
    python -m src.main
    ```

Le script va lire chaque lien, déterminer s'il s'agit d'un LN ou d'un Manga, créer la structure sur votre Drive s'il le faut, et télécharger les chapitres manquants.

## Sites supportés

Actuellement, les parsers sont configurés pour les sites suivants :
*   `shmtranslations.com` (Light Novels)
*   `poseidon-scans.net` (Mangas)
*   `scan-manga.com` (Mangas)

*Pour ajouter de nouveaux sites, il faudra modifier les classes dans `src/scrapers/parsers.py`.*
