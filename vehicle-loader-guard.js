(() => {
  const root = document.getElementById('vehicleDetail');
  const id = new URLSearchParams(location.search).get('id');
  const URL = 'https://dpsgtliddmdvfwjahkkq.supabase.co';
  const KEY = 'sb_publishable_f-MRqpvq-FGsxQ7dBNIyKQ_r8MB1VM0';
  if (!root || !id) return;

  const esc = v => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  const money = v => Number.isFinite(Number(v)) ? new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD',maximumFractionDigits:0}).format(Number(v)) : '$—';
  const get = async (table, params) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    try {
      const response = await fetch(`${URL}/rest/v1/${table}?${new URLSearchParams(params)}`, { headers: { apikey: KEY }, signal: controller.signal });
      if (!response.ok) throw new Error(`${table}: ${response.status}`);
      return response.json();
    } finally { clearTimeout(timer); }
  };

  async function recover() {
    if (!/Loading vehicle/i.test(root.textContent || '')) return true;
    try {
      const rows = await get('Vehicles', { select:'*', id:`eq.${id}` });
      const v = rows[0];
      if (!v) { root.innerHTML = '<div class="inventory-empty">This vehicle is no longer available.</div>'; return true; }

      const photos = await get('vehicle_images', { select:'*', vehicle_id:`eq.${id}`, order:'is_primary.desc,sort_order.asc' }).catch(() => []);
      const title = `${v.Year || ''} ${v.Make || ''} ${v.Model || ''}`.trim();
      const sold = String(v.Status || '').toLowerCase() === 'sold';
      const image = photos[0]?.image_url || '';
      const fields = [['Year',v.Year],['Make',v.Make],['Model',v.Model],['Trim',v.Trim],['Odometer',v.Mileage ? `${Number(v.Mileage).toLocaleString('en-CA')} km` : null],['Body Style',v.BodyStyle],['Transmission',v.Transmission],['Engine Size',v.EngineSize],['Drivetrain',v.Drivetrain],['Exterior Colour',v.ExteriorColor],['Interior Colour',v.InteriorColor],['VIN',v.VIN]].filter(([,x]) => x !== null && x !== undefined && x !== '');
      root.innerHTML = `<div class="vehicle-detail-grid"><section class="detail-gallery"><div class="detail-main-image ${image ? '' : 'placeholder'}">${image ? `<img id="guardVehiclePhoto" src="${esc(image)}" alt="${esc(title)}">` : '<span>PHOTO COMING SOON</span>'}</div></section><section class="detail-info"><p class="detail-year">${sold ? 'SOLD' : 'PRE-OWNED'}</p><h1 class="detail-title">${esc(title)}</h1><div class="detail-meta"><span>${v.Mileage ? Number(v.Mileage).toLocaleString('en-CA') : '—'} km</span><span>${esc(v.Transmission || 'Automatic')}</span></div><div class="detail-price"><strong>${money(v.Price)}</strong></div>${sold ? '<span class="sold-label">This vehicle has been sold</span>' : `<div class="primary-action-row"><a class="btn btn-primary" href="book-test-drive.html?vehicle=${encodeURIComponent(v.id)}">Book a Test Drive</a><a class="btn detail-outline" href="pre-approval.html?vehicle=${encodeURIComponent(v.id)}">Get Pre-Approved</a></div>`}<div class="detail-description"><h2>Vehicle Details</h2><p>${esc(v.Description || 'Contact M.O Motors for complete vehicle details, features and availability.').replaceAll('\n','<br>')}</p></div><div class="spec-grid">${fields.map(([k,x]) => `<div><span>${esc(k)}</span><b>${esc(x)}</b></div>`).join('')}</div></section></div>`;
      document.title = `${title} | M.O Motors`;
      return true;
    } catch (error) {
      console.error('Vehicle loader guard:', error);
      return false;
    }
  }

  setTimeout(async () => {
    if (await recover()) return;
    setTimeout(recover, 2500);
  }, 1800);
})();
