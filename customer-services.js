(() => {
  const U = "https://dpsgtliddmdvfwjahkkq.supabase.co",
    K = "sb_publishable_f-MRqpvq-FGsxQ7dBNIyKQ_r8MB1VM0",
    H = {
      apikey: K,
      Authorization: `Bearer ${K}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    };
  function values(form) {
    const fd = new FormData(form),
      details = {};
    for (const [key, value] of fd) {
      if (["first_name", "last_name", "phone", "email"].includes(key)) continue;
      if (details[key] === undefined) details[key] = value;
      else if (Array.isArray(details[key])) details[key].push(value);
      else details[key] = [details[key], value];
    }
    return {
      request_type: form.dataset.requestType,
      first_name: String(fd.get("first_name") || "").trim(),
      last_name: String(fd.get("last_name") || "").trim(),
      phone: String(fd.get("phone") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      details,
    };
  }
  document.querySelectorAll(".customer-request-form").forEach((form) =>
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const button = form.querySelector('button[type="submit"]'),
        status = form.querySelector(".form-status"),
        original = button.textContent;
      button.disabled = true;
      button.textContent = "Sending…";
      status.textContent = "";
      try {
        if (["localhost", "127.0.0.1"].includes(location.hostname)) {
          await new Promise((resolve) => setTimeout(resolve, 250));
          status.textContent =
            "Local preview complete — the form validated successfully and no customer data was saved.";
          return;
        }
        const response = await fetch(`${U}/rest/v1/customer_requests`, {
          method: "POST",
          headers: H,
          body: JSON.stringify(values(form)),
        });
        if (!response.ok) throw new Error(await response.text());
        form.reset();
        status.textContent =
          "Thank you. Your request has been received and M.O. Motors will contact you shortly.";
      } catch (error) {
        console.error("Customer request submission failed", error);
        status.textContent =
          "The request could not be sent right now. Please call M.O. Motors at 204-963-4462.";
      } finally {
        button.disabled = false;
        button.textContent = original;
      }
    }),
  );
  const intent = new URLSearchParams(location.search).get("intent"),
    map = { trade: "Trade In", sell: "Sell", consign: "Consignment" };
  if (intent && map[intent])
    document
      .querySelector(`input[name="request_goal"][value="${map[intent]}"]`)
      ?.click();
})();
