(() => {
  const U = "https://dpsgtliddmdvfwjahkkq.supabase.co";
  const K = "sb_publishable_f-MRqpvq-FGsxQ7dBNIyKQ_r8MB1VM0";
  const H = { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json" };
  const fallback = { booking_start: "12:00:00", booking_end: "18:00:00", slot_minutes: 30 };

  function minutes(value) {
    const [hours = 0, mins = 0] = String(value || "").split(":").map(Number);
    return hours * 60 + mins;
  }

  function label(total) {
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    const date = new Date(2000, 0, 1, hours, mins);
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  function createSlots(settings = fallback) {
    const start = minutes(settings.booking_start);
    const end = minutes(settings.booking_end);
    const interval = Number(settings.slot_minutes) || 30;
    const slots = [];
    for (let current = start; current < end; current += interval) slots.push(label(current));
    return slots;
  }

  async function loadSettings() {
    try {
      const response = await fetch(`${U}/rest/v1/booking_settings?select=booking_start,booking_end,slot_minutes&id=eq.1`, { headers: H });
      if (!response.ok) throw new Error("Unable to load booking settings");
      const [settings] = await response.json();
      return settings || fallback;
    } catch (error) {
      console.warn(error);
      return fallback;
    }
  }

  window.moBookingAvailability = { U, K, H, fallback, createSlots, loadSettings };
})();
