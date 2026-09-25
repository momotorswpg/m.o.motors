(() => {
  const root = document.getElementById("vehicleDetail");
  if (!root) return;
  const update = () => {
    const heading = root.querySelector(".detail-title");
    if (!heading || typeof window.updateVehicleSeo !== "function") return false;
    const parts = heading.textContent.trim().split(/\s+/);
    const specs = {};
    root.querySelectorAll(".stable-specs > div").forEach(row => {
      const label = row.querySelector("span")?.textContent.trim();
      const value = row.querySelector("b")?.textContent.trim();
      if (label && value) specs[label] = value;
    });
    window.updateVehicleSeo({
      Year: specs.Year || parts.shift(),
      Make: specs.Make || parts.shift(),
      Model: specs.Model || parts.join(" "),
      Trim: specs.Trim,
      Mileage: Number((specs.Odometer || "").replace(/[^0-9]/g, "")) || undefined,
      VIN: specs.VIN,
      Price: Number((root.querySelector(".detail-price strong")?.textContent || "").replace(/[^0-9.]/g, "")) || 0,
      Status: root.querySelector(".detail-year")?.textContent.trim()
    }, Array.from(root.querySelectorAll(".detail-main-image img, .detail-thumb img")).map(image => ({ image_url:image.currentSrc || image.src })));
    return true;
  };
  if (update()) return;
  const observer = new MutationObserver(() => { if (update()) observer.disconnect(); });
  observer.observe(root, { childList:true, subtree:true });
})();
