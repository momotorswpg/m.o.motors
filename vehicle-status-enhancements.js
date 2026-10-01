(() => {
  const id = new URLSearchParams(location.search).get("id");
  if (!id) return;
  const U = "https://dpsgtliddmdvfwjahkkq.supabase.co";
  const K = "sb_publishable_f-MRqpvq-FGsxQ7dBNIyKQ_r8MB1VM0";

  async function applyStatus() {
    try {
      const response = await fetch(`${U}/rest/v1/Vehicles?select=Status&id=eq.${encodeURIComponent(id)}`, {
        headers: { apikey: K, Authorization: `Bearer ${K}` }
      });
      if (!response.ok) return;
      const vehicle = (await response.json())[0];
      if (String(vehicle?.Status || "").toLowerCase() !== "coming soon") return;

      const decorate = () => {
        const image = document.querySelector(".detail-main-image");
        const label = document.querySelector(".detail-year");
        if (!image || !label) return false;
        label.textContent = "COMING SOON";
        if (!image.querySelector(".coming-soon-badge")) {
          image.insertAdjacentHTML("beforeend", '<div class="coming-soon-badge">COMING SOON</div>');
        }
        return true;
      };

      if (decorate()) return;
      const observer = new MutationObserver(() => {
        if (decorate()) observer.disconnect();
      });
      observer.observe(document.getElementById("vehicleDetail"), { childList: true, subtree: true });
    } catch (error) {
      console.warn("Could not apply vehicle status label", error);
    }
  }

  applyStatus();
})();
