(() => {
  const SUPABASE_URL = "https://dpsgtliddmdvfwjahkkq.supabase.co";
  const SUPABASE_KEY = "sb_publishable_f-MRqpvq-FGsxQ7dBNIyKQ_r8MB1VM0";
  const DEFAULTS = Object.freeze({ apr: 8.99, term_months: 48, down_payment: 0, financing_fee: 699, payment_frequency: "biweekly" });
  let settingsPromise;
  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const frequency = value => value === "weekly" ? { value: "weekly", periods: 52, label: "weekly" } : value === "monthly" ? { value: "monthly", periods: 12, label: "monthly" } : { value: "biweekly", periods: 26, label: "bi-weekly" };
  const normalize = value => ({ ...DEFAULTS, ...(value || {}), apr: number(value?.apr, DEFAULTS.apr), term_months: number(value?.term_months, DEFAULTS.term_months), down_payment: number(value?.down_payment, DEFAULTS.down_payment), financing_fee: number(value?.financing_fee, DEFAULTS.financing_fee), payment_frequency: frequency(value?.payment_frequency).value });
  async function load({ fresh = false } = {}) {
    if (!settingsPromise || fresh) settingsPromise = fetch(`${SUPABASE_URL}/rest/v1/finance_settings?select=*&id=eq.1`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }).then(async response => {
      if (!response.ok) throw new Error(await response.text());
      return normalize((await response.json())[0]);
    }).catch(error => { console.warn("Using fallback finance settings", error); return normalize(); });
    return settingsPromise;
  }
  function calculate({ price = 0, warranty = 0, down, trade = 0, includeTax = true, includeFee = true, settings = DEFAULTS } = {}) {
    const current = normalize(settings), vehiclePrice = Math.max(0, number(price)), warrantyPrice = Math.max(0, number(warranty));
    const downPayment = Math.max(0, number(down, current.down_payment)), tradeValue = Math.max(0, number(trade));
    const fee = includeFee ? Math.max(0, current.financing_fee) : 0, tax = includeTax ? (vehiclePrice + warrantyPrice) * 0.12 : 0;
    const principal = Math.max(0, vehiclePrice + warrantyPrice + tax + fee - downPayment - tradeValue), cadence = frequency(current.payment_frequency);
    const payments = current.term_months / 12 * cadence.periods, periodicRate = current.apr / 100 / cadence.periods;
    const payment = !principal || !payments ? 0 : periodicRate ? principal * periodicRate / (1 - Math.pow(1 + periodicRate, -payments)) : principal / payments;
    return { vehiclePrice, warranty: warrantyPrice, tax, fee, down: downPayment, trade: tradeValue, principal, payment, payments, total: payment * payments, ...cadence };
  }
  window.MOMotorsFinance = { DEFAULTS, normalize, frequency, load, calculate };
})();
