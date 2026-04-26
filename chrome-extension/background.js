chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchImage") {
    const url = request.url;
    const pageUrl = request.pageUrl;

    // Set up a dynamic rule to inject the Referer header to bypass hotlink protection
    const ruleId = 1;
    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [ruleId],
      addRules: [{
        id: ruleId,
        priority: 1,
        action: {
          type: "modifyHeaders",
          requestHeaders: [
            { header: "Referer", operation: "set", value: pageUrl },
            { header: "Origin", operation: "set", value: new URL(pageUrl).origin }
          ]
        },
        condition: { urlFilter: url, resourceTypes: ["xmlhttprequest"] }
      }]
    }).then(() => {
      // Now fetch the image. The rule will automatically attach the correct Referer.
      return fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        }
      });
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