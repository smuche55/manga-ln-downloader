// This script is injected into the active tab to extract images

function extractImages() {
  let images = [];
  let title = document.title;
  const url = window.location.href;

  // 1. Poseidon Scans (usually inside .page-break or .reading-content)
  if (url.includes('poseidon-scans.net')) {
    const imgTags = document.querySelectorAll('.page-break img, .reading-content img');
    imgTags.forEach(img => {
      let src = img.getAttribute('data-src') || img.getAttribute('src');
      if (src && !src.includes('discord') && !src.includes('logo')) {
        images.push(src.trim());
      }
    });
  }
  // 2. Scan-Manga (usually inside #page_b or elements with class scan-page)
  else if (url.includes('scan-manga.com')) {
    const imgTags = document.querySelectorAll('#page_b img, img.scan-page');
    imgTags.forEach(img => {
      let src = img.getAttribute('data-src') || img.getAttribute('src');
      if (src) {
        images.push(src.trim());
      }
    });
  }
  // 3. Generic Fallback
  else {
    // Attempt to find the main reading container to avoid UI images
    const containers = document.querySelectorAll('.reading-content, #readerarea, .epwrapper, .chapter-video-frame');
    let target = containers.length > 0 ? containers[0] : document.body;
    
    const imgTags = target.querySelectorAll('img');
    imgTags.forEach(img => {
      let src = img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('src');
      // Filter out obvious tracking pixels or tiny UI icons
      if (src && src.length > 10 && (img.width > 100 || img.height > 100 || !img.complete)) {
        // Resolve relative URLs to absolute
        if (src.startsWith('/')) {
            src = window.location.origin + src;
        }
        images.push(src.trim());
      }
    });
  }

  // Clean title for filename
  let safeTitle = title.replace(/[^a-zA-Z0-9\s-]/g, '').trim();
  
  return {
    title: safeTitle,
    images: [...new Set(images)] // Remove duplicates
  };
}

// Execute and return
extractImages();