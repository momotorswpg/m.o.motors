(() => {
  const $ = id => document.getElementById(id);
  const vin = $("vin");
  const button = $("vinLookupBtn");
  const status = $("vinLookupStatus");
  if (!vin || !button || !status) return;
  const set = (id, value) => { const input = $(id); if (input && value != null && String(value).trim()) input.value = String(value).trim(); };
  async function lookup() {
    const value = vin.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    vin.value = value;
    if (value.length !== 17) { status.textContent = "Enter a valid 17-character VIN."; return; }
    button.disabled = true;
    status.textContent = "Looking up vehicle…";
    try {
      const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${encodeURIComponent(value)}?format=json`);
      if (!response.ok) throw new Error("VIN lookup service is unavailable.");
      const vehicle = (await response.json()).Results?.[0];
      if (!vehicle) throw new Error("No vehicle information was returned.");
      const fields = {year:vehicle.ModelYear,make:vehicle.Make,model:vehicle.Model,trim:vehicle.Trim,bodyStyle:vehicle.BodyClass,transmission:vehicle.TransmissionStyle||vehicle.TransmissionSpeeds,drivetrain:vehicle.DriveType,engineCylinders:vehicle.EngineCylinders,engineSize:vehicle.DisplacementL,fuelType:vehicle.FuelTypePrimary,doors:vehicle.Doors,passengers:vehicle.Seats};
      Object.entries(fields).forEach(([id, fieldValue]) => set(id, fieldValue));
      status.textContent = "Vehicle details filled in. Please verify the VIN data before saving.";
    } catch (error) {
      console.error(error);
      status.textContent = `Could not look up this VIN: ${error.message}`;
    } finally { button.disabled = false; }
  }
  button.addEventListener("click", lookup);
  vin.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); lookup(); } });
})();
