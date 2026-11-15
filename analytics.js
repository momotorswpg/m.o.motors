(() => {
  const measurementId = "G-D8JTF9YW53";
  const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);

  window.moTrack = (eventName, parameters = {}) => {
    if (isLocal || typeof window.gtag !== "function") return;
    window.gtag("event", eventName, parameters);
  };

  if (isLocal) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", measurementId, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    cookie_flags: "SameSite=Lax;Secure",
  });

  const tag = document.createElement("script");
  tag.async = true;
  tag.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(tag);

  const pageName = location.pathname.split("/").filter(Boolean).pop() || "home";
  const params = new URLSearchParams(location.search);
  if (pageName === "vehicle.html" && params.get("id")) {
    window.moTrack("view_item", {
      item_id: params.get("id"),
      item_category: "vehicle",
    });
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link) return;
    const rawHref = link.getAttribute("href") || "";
    let url;
    try {
      url = new URL(rawHref, location.href);
    } catch {
      return;
    }

    if (url.protocol === "tel:") {
      window.moTrack("phone_call_click", { page_name: pageName });
      return;
    }

    const isMapLink =
      url.hostname === "share.google" ||
      ((url.hostname.endsWith("google.com") || url.hostname.endsWith("google.ca")) &&
        (url.pathname.includes("/maps") || url.searchParams.has("q")));
    if (isMapLink) {
      window.moTrack("directions_click", { page_name: pageName });
      return;
    }

    if (url.pathname.includes("book-test-drive") || url.pathname.startsWith("/booking")) {
      window.moTrack("test_drive_start", { page_name: pageName });
    } else if (url.pathname.includes("pre-approval")) {
      window.moTrack("finance_application_start", { page_name: pageName });
    }
  });

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await nativeFetch(...args);
    try {
      const input = args[0];
      const options = args[1] || {};
      const requestUrl = typeof input === "string" ? input : input?.url || "";
      const requestMethod = String(options.method || input?.method || "GET").toUpperCase();
      if (response.ok && requestMethod === "POST") {
        let leadType = "";
        if (requestUrl.includes("/test_drive_bookings")) leadType = "test_drive_booking";
        else if (requestUrl.includes("/finance_applications")) leadType = "finance_application";
        else if (requestUrl.includes("/trade_in_requests")) leadType = "trade_in";
        else if (requestUrl.includes("/customer_requests")) {
          leadType = document.querySelector(".customer-request-form")?.dataset.requestType || "customer_request";
        }
        if (leadType) window.moTrack("generate_lead", { lead_type: leadType });
      }
    } catch (error) {
      console.debug("Analytics event skipped", error);
    }
    return response;
  };
})();
