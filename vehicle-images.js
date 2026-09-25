(() => {
  function thumbnail(url, width = 720, height = 480) {
    if (!url || !url.includes("/storage/v1/object/public/")) return url;
    const transformed = url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
    const separator = transformed.includes("?") ? "&" : "?";
    return `${transformed}${separator}width=${width}&height=${height}&resize=cover&quality=72`;
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
  const start=()=>{optimizeCards();new MutationObserver(mutations=>mutations.forEach(mutation=>mutation.addedNodes.forEach(node=>{if(node.nodeType===1)optimizeCards(node)}))).observe(document.body,{childList:true,subtree:true})};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
  window.MOMotorsImages = { thumbnail, bindFallbacks, optimizeCards };
})();
