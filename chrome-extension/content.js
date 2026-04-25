// This script is injected into the active tab to extract images

function extractImages() {
  let images = [];
  let title = document.title;
  const url = window.location.href;

  // Generic but aggressive image extraction logic
  // We don't rely on specific wrappers anymore, just find all images that look like manga pages
  const imgTags = document.querySelectorAll('img');
  
  imgTags.forEach(img => {
    // Sites often hide the real image source in data attributes for lazy loading
    let src = img.getAttribute('data-src') || 
              img.getAttribute('data-lazy-src') || 
              img.getAttribute('data-original') || 
              img.getAttribute('data-aload') || 
              img.getAttribute('src');

    // Filter logic to find manga pages and ignore UI/icons
    if (src && src.length > 10) {
      // Exclude common UI elements
      const lowerSrc = src.toLowerCase();
      if (lowerSrc.includes('logo') || lowerSrc.includes('discord') || lowerSrc.includes('avatar') || lowerSrc.includes('banner')) {
        return;
      }
      
      // Manga pages are usually large. If the image is loaded, check its size.
      // If it's NOT loaded yet (img.complete is false, or naturalWidth is 0), we assume it might be a lazy-loaded manga page.
      // Also, sometimes CSS sets width to 100%, so we can check clientWidth or just assume if it has a data-src it's a page.
      let isLikelyPage = false;
      
      if (img.hasAttribute('data-src') || img.hasAttribute('data-lazy-src')) {
        isLikelyPage = true; // Lazy loaded images are almost always the manga pages
      } else if (img.naturalWidth > 300 || img.naturalHeight > 400) {
        isLikelyPage = true; // It's a large image
      } else if (img.clientWidth > 300 || img.clientHeight > 400) {
        isLikelyPage = true; // It's styled to be large
      } else if (!img.complete || img.naturalWidth === 0) {
        // Not loaded yet, let's guess it's a page if it's in the middle of the document
        isLikelyPage = true;
      }

      if (isLikelyPage) {
        // Resolve relative URLs to absolute
        if (src.startsWith('//')) {
          src = window.location.protocol + src;
        } else if (src.startsWith('/')) {
          src = window.location.origin + src;
        }
        images.push(src.trim());
      }
    }
  });

  // Clean title for filename
  let safeTitle = title.replace(/[^a-zA-Z0-9\s-]/g, '').trim();
  
  return {
    title: safeTitle,
    images: [...new Set(images)] // Remove duplicates
  };
}

// Execute and return
extractImages();