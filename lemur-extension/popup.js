document.addEventListener('DOMContentLoaded', function() {
  const btnDownload = document.getElementById('btn-download');
  const statusDiv = document.getElementById('status');
  const progressContainer = document.getElementById('progress-container');
  const progressFill = document.getElementById('progress-fill');

  function updateStatus(msg, type='info') {
    statusDiv.textContent = msg;
    if (type === 'error') statusDiv.className = 'error';
    else if (type === 'success') statusDiv.className = 'success';
    else statusDiv.className = '';
  }

  function setProgress(percent) {
    progressContainer.style.display = 'block';
    progressFill.style.width = percent + '%';
  }

  // --- OAuth via WebAuthFlow ---
  async function getGoogleAuthToken() {
    const manifest = chrome.runtime.getManifest();
    const clientId = manifest.oauth2.client_id;
    const scopes = manifest.oauth2.scopes.join(' ');
    // Chrome provides a stable redirect URL for extensions
    const redirectUri = chrome.identity.getRedirectURL(); 

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `response_type=token&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scopes)}`;

    console.log("Redirect URI to whitelist in Google Cloud Console:", redirectUri);

    return new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true
      }, function(redirectUrl) {
        if (chrome.runtime.lastError || !redirectUrl) {
          return reject(new Error(chrome.runtime.lastError?.message || "Authentification annulée ou échouée."));
        }

        // Extract the token from the redirect URL fragment (e.g., ...#access_token=ya29.a0A...)
        const urlObj = new URL(redirectUrl);
        const params = new URLSearchParams(urlObj.hash.substring(1)); // substring(1) to remove '#'
        const token = params.get('access_token');
        
        if (!token) {
          return reject(new Error("Token d'accès introuvable dans la réponse."));
        }

        resolve(token);
      });
    });
  }
  // ------------------------------

  btnDownload.addEventListener('click', async () => {
    btnDownload.disabled = true;
    updateStatus("Extraction des images depuis la page...");
    setProgress(5);

    try {
      // 1. Get active tab
      let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // 2. Inject and execute content.js to get image URLs
      let results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });

      if (!results || !results[0] || !results[0].result) {
        throw new Error("Impossible d'exécuter le script d'extraction.");
      }

      let data = results[0].result;
      if (!data.images || data.images.length === 0) {
        throw new Error("Aucune image trouvée sur cette page.");
      }

      updateStatus(`Trouvé ${data.images.length} images. Préparation du CBZ...`);
      setProgress(10);

      // 3. Create Zip file
      let zip = new JSZip();
      let total = data.images.length;
      let count = 0;

      // Function to fetch image via background script
      const fetchImageViaBackground = (url, pageUrl) => {
        return new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ action: "fetchImage", url: url, pageUrl: pageUrl }, (response) => {
            if (chrome.runtime.lastError) {
              return reject(new Error(chrome.runtime.lastError.message));
            }
            if (!response) {
              return reject(new Error("No response from background script"));
            }
            if (response.success) {
              fetch(response.dataUrl)
                .then(res => res.blob())
                .then(resolve)
                .catch(reject);
            } else {
              reject(new Error(response.error));
            }
          });
        });
      };

      for (let i = 0; i < total; i++) {
        let imgUrl = data.images[i];
        try {
          updateStatus(`Téléchargement de l'image ${i+1}/${total}...`);
          let blob = await fetchImageViaBackground(imgUrl, tab.url);
          let ext = '.jpg';
          if (blob.type === 'image/png') ext = '.png';
          else if (blob.type === 'image/webp') ext = '.webp';
          else if (blob.type === 'image/gif') ext = '.gif';
          
          let filename = String(i).padStart(3, '0') + ext;
          zip.file(filename, blob);
          
          count++;
          setProgress(10 + Math.floor((count / total) * 40)); 
        } catch (e) {
          console.error("Erreur téléchargement image:", imgUrl, e);
        }
      }

      if (count === 0) {
        throw new Error("Toutes les images ont échoué au téléchargement.");
      }

      updateStatus("Compression du fichier CBZ...");
      let cbzBlob = await zip.generateAsync({ type: "blob" });
      setProgress(60);

      updateStatus("Connexion à Google Drive (WebAuthFlow)...");
      
      // 4. Auth with Google using launchWebAuthFlow
      let token = await getGoogleAuthToken();

      updateStatus("Recherche du dossier 'Lecture/Mangas' sur Drive...");
      let lectureFolderId = await getOrCreateFolder(token, 'Lecture');
      let mangasFolderId = await getOrCreateFolder(token, 'Mangas', lectureFolderId);

      updateStatus("Envoi vers Google Drive...");
      setProgress(70);

      // 5. Upload to Drive (Multipart upload)
      let filename = data.title + ".cbz";
      let fileId = await uploadFileToDrive(token, cbzBlob, filename, mangasFolderId);
      
      setProgress(100);
      updateStatus(`Succès ! Fichier sauvegardé sur Drive.\nID: ${fileId}`, 'success');
      btnDownload.disabled = false;

    } catch (error) {
      updateStatus(error.message, 'error');
      btnDownload.disabled = false;
    }
  });

  async function getOrCreateFolder(token, folderName, parentId = null) {
    let query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
    if (parentId) {
      query += ` and '${parentId}' in parents`;
    }

    let url = 'https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(query) + '&fields=files(id)';
    let res = await fetch(url, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) throw new Error(`Erreur lors de la recherche du dossier ${folderName}`);
    let data = await res.json();

    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }

    const metadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };
    if (parentId) {
      metadata.parents = [parentId];
    }

    res = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metadata)
    });

    if (!res.ok) throw new Error(`Erreur lors de la création du dossier ${folderName}`);
    data = await res.json();
    return data.id;
  }

  async function uploadFileToDrive(token, fileBlob, filename, parentFolderId) {
    const metadata = {
      name: filename,
      mimeType: 'application/vnd.comicbook+zip',
    };
    if (parentFolderId) {
      metadata.parents = [parentFolderId];
    }

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', fileBlob);

    let res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token
      },
      body: form
    });

    if (!res.ok) {
      let errText = await res.text();
      throw new Error("Upload API Error: " + errText);
    }

    let data = await res.json();
    return data.id;
  }
});
