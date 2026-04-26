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

      // Function to fetch image via background script to bypass CORS/Referer issues
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
              // Convert base64 Data URL back to Blob
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
          
          // Fetch image via background script
          let blob = await fetchImageViaBackground(imgUrl, tab.url);
          
          // Determine extension
          let ext = '.jpg';
          if (blob.type === 'image/png') ext = '.png';
          else if (blob.type === 'image/webp') ext = '.webp';
          else if (blob.type === 'image/gif') ext = '.gif';
          
          // Pad number with zeros (e.g., 001.jpg, 002.jpg)
          let filename = String(i).padStart(3, '0') + ext;
          zip.file(filename, blob);
          
          count++;
          setProgress(10 + Math.floor((count / total) * 40)); // Up to 50%
        } catch (e) {
          console.error("Erreur téléchargement image:", imgUrl, e);
          // Continue with next image even if one fails
        }
      }

      if (count === 0) {
        throw new Error("Toutes les images ont échoué au téléchargement.");
      }

      updateStatus("Compression du fichier CBZ...");
      let cbzBlob = await zip.generateAsync({ type: "blob" });
      setProgress(60);

      updateStatus("Connexion à Google Drive...");
      
      // 4. Auth with Google
      chrome.identity.getAuthToken({ 'interactive': true }, async function(token) {
        if (chrome.runtime.lastError || !token) {
           updateStatus("Erreur d'authentification Google: " + (chrome.runtime.lastError?.message || "Token nul"), 'error');
           btnDownload.disabled = false;
           return;
        }

        try {
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
        } catch (err) {
          updateStatus("Erreur d'envoi: " + err.message, 'error');
        }
        btnDownload.disabled = false;
      });

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