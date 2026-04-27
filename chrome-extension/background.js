chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchImage") {
    fetch(request.url, {
      method: 'GET',
      headers: {
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        // 'Referer' is often automatically added by the browser in background scripts,
        // which helps bypass some anti-hotlinking protections.
      }
    })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.blob();
    })
    .then(blob => {
      // We must convert the blob to a base64 string to send it back via Chrome messaging
      const reader = new FileReader();
      reader.onloadend = () => {
        sendResponse({ success: true, dataUrl: reader.result, type: blob.type });
      };
      reader.readAsDataURL(blob);
    })
    .catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep the message channel open for the async response
  }
});
