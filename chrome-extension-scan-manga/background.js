let currentReferer = "";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchImage") {
    const url = request.url;
    const pageUrl = request.pageUrl;

    const ruleId = 1;

    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [ruleId],
      addRules: [{
        id: ruleId,
        priority: 1,
        action: {
          type: "modifyHeaders",
          requestHeaders: [
            { header: "Referer", operation: "set", value: pageUrl }
          ]
        },
        condition: { urlFilter: "*", resourceTypes: ["xmlhttprequest"] }
      }]
    }).then(() => {
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
      const reader = new FileReader();
      reader.onloadend = () => {
        sendResponse({ success: true, dataUrl: reader.result, type: blob.type });
      };
      reader.readAsDataURL(blob);
    })
    .catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    
    return true; // async response
  }
});
