(() => {
  const preloadCache = new Map();

  function thumbnail(url, width = 720, height = 480) {
    if (!url || !url.includes("/storage/v1/object/public/")) return url;
    const transformed = url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
    const separator = transformed.includes("?") ? "&" : "?";
    return `${transformed}${separator}width=${width}&height=${height}&resize=cover&quality=72`;
  }
  function preload(url) {
    if (!url) return Promise.resolve();
    const optimized = thumbnail(url);
    if (preloadCache.has(optimized)) return preloadCache.get(optimized);
    const pending = new Promise(resolve => {
      const image = new Image();
      image.onload = image.onerror = resolve;
      image.decoding = "async";
      image.src = optimized;
    });
    preloadCache.set(optimized, pending);
    return pending;
  }
  function preloadNeighbors(gallery, index = 0) {
    if (!Array.isArray(gallery) || gallery.length < 2) return;
    const next = (index + 1) % gallery.length;
    const previous = (index - 1 + gallery.length) % gallery.length;
    preload(gallery[next]);
    if (previous !== next) preload(gallery[previous]);
  }
  function warmCardGalleries(root = document) {
    const cards = [...root.querySelectorAll?.(".vehicle-image[data-gallery]") || []];
    const warm = card => {
      if (card.dataset.galleryWarmed) return;
      card.dataset.galleryWarmed = "true";
      try {
        preloadNeighbors(JSON.parse(card.dataset.gallery || "[]"), Number(card.dataset.index) || 0);
      } catch (error) {
        console.warn("Unable to preload vehicle gallery", error);
      }
    };
    if (!("IntersectionObserver" in window)) {
      cards.forEach(warm);
      return;
    }
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      warm(entry.target);
      observer.unobserve(entry.target);
    }), { rootMargin: "400px 0px" });
    cards.forEach(card => observer.observe(card));
  }
  function bindFallbacks(root = document) {
    root.querySelectorAll("img[data-original-src]").forEach(image => {
      if (image.dataset.fallbackBound) return;
      image.dataset.fallbackBound = "true";
      image.addEventListener("error", () => {
        const original = image.dataset.originalSrc;
        if (original && image.src !== original) image.src = original;
      }, { once: true });
    });
  }
  function optimizeCards(root = document) {
    root.querySelectorAll?.(".vehicle-card .vehicle-image img").forEach(image => {
      const current=image.getAttribute("src")||"";
      if(!current.includes("/storage/v1/object/public/"))return;
      image.dataset.originalSrc=current;
      image.setAttribute("src",thumbnail(current));
      image.setAttribute("width","720");image.setAttribute("height","480");image.decoding="async";
    });
    bindFallbacks(root);
  }
  const start=()=>{optimizeCards();warmCardGalleries();new MutationObserver(mutations=>mutations.forEach(mutation=>mutation.addedNodes.forEach(node=>{if(node.nodeType===1){optimizeCards(node);warmCardGalleries(node)}}))).observe(document.body,{childList:true,subtree:true})};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
  window.MOMotorsImages = { thumbnail, preload, preloadNeighbors, warmCardGalleries, bindFallbacks, optimizeCards };
})();
