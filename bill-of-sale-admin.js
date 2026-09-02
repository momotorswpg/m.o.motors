(() => {
  const TEMPLATE_URL = "/assets/documents/mo-motors-bill-of-sale-template.pdf";
  const TREATY_TEMPLATE_URL = "/assets/documents/mo-motors-bill-of-sale-treaty-template.pdf";
  const SIGNATURE_URL = "/assets/images/mohaimen-ornob-signature.png";
  const $ = id => document.getElementById(id);
  const moneyIds = ["bosSalePrice","bosTradeValue","bosWarranty","bosDocumentFee","bosSubtotal","bosGst","bosRst","bosTotal","bosDeposit","bosBalance"];
  let vehicles = [];
  let loaded = false;
  let previewUrl = "";
  let addressTimer = 0;
  let addressController = null;
  const addressCache = new Map();

  const value = id => ($(id)?.value || "").trim();
  const escapeHtml = input => String(input ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
  const number = id => Number($(id)?.value || 0);
  const set = (id, next) => { if ($(id)) $(id).value = next ?? ""; };
  const setStatus = message => { if ($("bosStatus")) $("bosStatus").textContent = message || ""; };
  const round = amount => Math.round((Number(amount) + Number.EPSILON) * 100) / 100;
  const formatDate = iso => {
    if (!iso) return "";
    const [year,month,day] = iso.split("-");
    return year && month && day ? `${month}/${day}/${year}` : iso;
  };
  const currency = amount => Number(amount || 0).toLocaleString("en-CA", {minimumFractionDigits:2,maximumFractionDigits:2});
  const generateInvoiceNumber = date => {
    const pad = (part,length = 2) => String(part).padStart(length,"0");
    const day = `${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}`;
    const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
    return `MO-${day}-${time}-${pad(date.getMilliseconds(),3)}`;
  };

  function recalculate() {
    const subtotal = round(number("bosSalePrice") - number("bosTradeValue") + number("bosWarranty") + number("bosDocumentFee"));
    const treatySale = value("bosSaleType") === "treaty";
    const gst = treatySale ? 0 : round(subtotal * .05);
    const rst = treatySale ? 0 : round(subtotal * .07);
    const total = round(subtotal + gst + rst);
    set("bosSubtotal", subtotal.toFixed(2));
    set("bosGst", gst.toFixed(2));
    set("bosRst", rst.toFixed(2));
    set("bosTotal", total.toFixed(2));
    set("bosBalance", round(total - number("bosDeposit")).toFixed(2));
  }

  function updateSaleType() {
    const treatySale = value("bosSaleType") === "treaty";
    if ($("bosTreatyFields")) $("bosTreatyFields").hidden = !treatySale;
    ["bosTreatyNumber","bosRequestedDeliveryDate"].forEach(id => { if ($(id)) $(id).required = treatySale; });
    ["bosGst","bosRst"].forEach(id => { if ($(id)) $(id).disabled = treatySale; });
    recalculate();
  }

  function resetForm() {
    $("billOfSaleForm")?.reset();
    const today = new Date();
    const iso = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0,10);
    set("bosDateSold", iso);
    set("bosInvoice", generateInvoiceNumber(today));
    set("bosSalesperson", "Mohaimen Ornob");
    set("bosTerms", "N/A");
    set("bosSaleType", "standard");
    if ($("bosIncludeSignature")) $("bosIncludeSignature").checked = true;
    set("bosVehicleSelect", "");
    closeSuggestions("bosVehicleSearch","bosVehicleSuggestions");
    closeSuggestions("bosBuyerAddress","bosAddressSuggestions");
    moneyIds.forEach(id => set(id, "0.00"));
    setStatus("");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = "";
    if ($("bosPreviewWrap")) $("bosPreviewWrap").hidden = true;
    updateSaleType();
  }

  function selectedVehicle() {
    return vehicles.find(vehicle => String(vehicle.id) === value("bosVehicleSelect"));
  }

  function populateVehicle() {
    const vehicle = selectedVehicle();
    if (!vehicle) return;
    set("bosVin", vehicle.VIN ?? vehicle.vin);
    set("bosYear", vehicle.Year ?? vehicle.year);
    set("bosMake", vehicle.Make ?? vehicle.make);
    set("bosModel", vehicle.Model ?? vehicle.model);
    set("bosMileage", vehicle.Mileage ?? vehicle.mileage);
    set("bosSalePrice", Number(vehicle.Price ?? vehicle.price ?? 0).toFixed(2));
    set("bosVehicleSearch", vehicleLabel(vehicle));
    closeSuggestions("bosVehicleSearch","bosVehicleSuggestions");
    recalculate();
  }

  function vehicleLabel(vehicle) {
    const title = `${vehicle.Year ?? vehicle.year ?? ""} ${vehicle.Make ?? vehicle.make ?? ""} ${vehicle.Model ?? vehicle.model ?? ""}`.trim();
    const vin = vehicle.VIN ?? vehicle.vin ?? "No VIN";
    return `${title} - ${vin}`;
  }

  function closeSuggestions(inputId,listId) {
    const list = $(listId);
    if (list) { list.hidden = true; list.innerHTML = ""; }
    $(inputId)?.setAttribute("aria-expanded","false");
  }

  function renderVehicleSuggestions() {
    const input = $("bosVehicleSearch");
    const list = $("bosVehicleSuggestions");
    if (!input || !list) return;
    const query = input.value.trim().toLowerCase();
    const matches = vehicles.filter(vehicle => !query || vehicleLabel(vehicle).toLowerCase().includes(query)).slice(0,8);
    if (!matches.length) {
      list.innerHTML = '<div class="bos-suggestion"><span>No available vehicles match your search.</span></div>';
    } else {
      list.innerHTML = matches.map(vehicle => {
        const title = `${vehicle.Year ?? vehicle.year ?? ""} ${vehicle.Make ?? vehicle.make ?? ""} ${vehicle.Model ?? vehicle.model ?? ""}`.trim();
        const vin = vehicle.VIN ?? vehicle.vin ?? "No VIN";
        return `<button class="bos-suggestion" type="button" role="option" data-bos-vehicle="${escapeHtml(vehicle.id)}"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(vin)}</span></button>`;
      }).join("");
    }
    list.hidden = false;
    input.setAttribute("aria-expanded","true");
  }

  async function loadVehicles() {
    const select = $("bosVehicleSelect");
    if (!select || typeof db === "undefined" || loaded) return;
    setStatus("Loading inventory...");
    try {
      const {data,error} = await db.from("Vehicles").select("*").eq("Status","Available").order("created_at", {ascending:false});
      if (error) throw error;
      vehicles = data || [];
      select.value = "";
      loaded = true;
      setStatus(vehicles.length ? `${vehicles.length} inventory vehicles available.` : "No inventory vehicles found.");
    } catch (error) {
      console.error(error);
      setStatus(`Could not load inventory: ${error.message}`);
    }
  }

  function formatPhotonAddress(feature) {
    const p = feature?.properties || {};
    const street = [p.housenumber,p.street || p.name].filter(Boolean).join(" ");
    const city = p.city || p.town || p.village || p.municipality || p.county;
    const province = p.state || p.county;
    const provincePostal = [province,p.postcode].filter(Boolean).join(" ");
    return [street,city,provincePostal,"Canada"].filter((part,index,array) => part && array.indexOf(part) === index).join(", ");
  }

  function renderAddressSuggestions(features) {
    const input = $("bosBuyerAddress");
    const list = $("bosAddressSuggestions");
    if (!input || !list) return;
    const suggestions = features.map(formatPhotonAddress).filter(Boolean).filter((item,index,array) => array.indexOf(item) === index).slice(0,6);
    if (!suggestions.length) { closeSuggestions("bosBuyerAddress","bosAddressSuggestions"); return; }
    list.innerHTML = suggestions.map(address => `<button class="bos-suggestion" type="button" role="option" data-bos-address="${escapeHtml(address)}"><strong>${escapeHtml(address)}</strong></button>`).join("");
    list.hidden = false;
    input.setAttribute("aria-expanded","true");
  }

  async function lookupAddress() {
    const query = value("bosBuyerAddress");
    if (query.length < 4) { closeSuggestions("bosBuyerAddress","bosAddressSuggestions"); return; }
    if (addressCache.has(query.toLowerCase())) { renderAddressSuggestions(addressCache.get(query.toLowerCase())); return; }
    addressController?.abort();
    addressController = new AbortController();
    try {
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(`${query}, Canada`)}&limit=6&lang=en`;
      const response = await fetch(url,{signal:addressController.signal,headers:{Accept:"application/json"}});
      if (!response.ok) throw new Error("Address lookup unavailable");
      const data = await response.json();
      const features = (data.features || []).filter(feature => String(feature?.properties?.countrycode || feature?.properties?.country || "").toLowerCase().includes("ca") || String(feature?.properties?.country || "").toLowerCase() === "canada");
      addressCache.set(query.toLowerCase(),features);
      renderAddressSuggestions(features);
    } catch (error) {
      if (error.name !== "AbortError") closeSuggestions("bosBuyerAddress","bosAddressSuggestions");
    }
  }

  function moveSuggestion(event,listId) {
    const list = $(listId);
    if (!list || list.hidden || !["ArrowDown","ArrowUp","Enter","Escape"].includes(event.key)) return;
    const options = [...list.querySelectorAll("button.bos-suggestion")];
    if (!options.length) return;
    event.preventDefault();
    let index = options.findIndex(option => option.classList.contains("active"));
    if (event.key === "Escape") { list.hidden = true; return; }
    if (event.key === "Enter") { (options[index] || options[0]).click(); return; }
    index = event.key === "ArrowDown" ? (index + 1) % options.length : (index <= 0 ? options.length - 1 : index - 1);
    options.forEach((option,i) => option.classList.toggle("active",i === index));
    options[index].scrollIntoView({block:"nearest"});
  }

  function wrapText(text, font, size, maxWidth, maxLines = 3) {
    const words = String(text || "").replace(/\s+/g," ").trim().split(" ").filter(Boolean);
    const lines = [];
    let line = "";
    words.forEach(word => {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate,size) <= maxWidth) line = candidate;
      else if (line) { lines.push(line); line = word; }
      else lines.push(word);
    });
    if (line) lines.push(line);
    if (lines.length > maxLines) {
      lines.length = maxLines;
      while (font.widthOfTextAtSize(`${lines[maxLines - 1]}...`,size) > maxWidth) lines[maxLines - 1] = lines[maxLines - 1].slice(0,-1);
      lines[maxLines - 1] += "...";
    }
    return lines;
  }

  function drawText(page, font, text, x, y, options = {}) {
    if (text === "" || text == null) return;
    const size = options.size || 8.5;
    const maxWidth = options.maxWidth || 1000;
    const lines = wrapText(text, font, size, maxWidth, options.maxLines || 1);
    lines.forEach((line,index) => page.drawText(line, {x,y:y-index*(options.lineHeight || size+2),size,font,color:PDFLib.rgb(0,0,0)}));
  }

  async function createPdf() {
    if (!window.PDFLib) throw new Error("The PDF generator did not load. Please refresh the page and try again.");
    if (!value("bosVehicleSelect")) throw new Error("Choose an available inventory vehicle from the suggestions first.");
    if (!value("bosVin") || !value("bosBuyerName") || !value("bosDateSold") || !value("bosInvoice")) throw new Error("Complete the invoice number, date sold, buyer name and vehicle information first.");
    const treatySale = value("bosSaleType") === "treaty";
    if (treatySale && (!value("bosTreatyNumber") || !value("bosRequestedDeliveryDate"))) throw new Error("Complete the treaty number and requested delivery date first.");
    const response = await fetch(treatySale ? TREATY_TEMPLATE_URL : TEMPLATE_URL, {cache:"no-store"});
    if (!response.ok) throw new Error("The original bill of sale template could not be loaded.");
    const template = await response.arrayBuffer();
    const pdf = await PDFLib.PDFDocument.load(template);
    const page = pdf.getPages()[0];
    const font = await pdf.embedFont(PDFLib.StandardFonts.Helvetica);
    const bold = await pdf.embedFont(PDFLib.StandardFonts.HelveticaBold);

    drawText(page,font,value("bosInvoice"),82,692,{maxWidth:112});
    drawText(page,font,formatDate(value("bosDateSold")),266,692,{maxWidth:116});
    drawText(page,font,value("bosSalesperson"),472,692,{maxWidth:102});
    drawText(page,font,value("bosBuyerName"),158,664,{maxWidth:410,size:9});
    drawText(page,font,value("bosBuyerAddress"),158,642,{maxWidth:410,size:8.5,maxLines:3,lineHeight:11});
    drawText(page,font,value("bosBuyerPhone"),158,612,{maxWidth:220,size:9});

    drawText(page,font,value("bosVin"),24,554,{maxWidth:140,size:8});
    drawText(page,font,value("bosYear"),174,554,{maxWidth:48,size:8});
    drawText(page,font,value("bosMake"),249,554,{maxWidth:105,size:8});
    drawText(page,font,value("bosModel"),368,554,{maxWidth:105,size:8});
    drawText(page,font,value("bosMileage"),487,554,{maxWidth:82,size:8});

    drawText(page,font,value("bosTerms"),23,480,{maxWidth:263,size:8,maxLines:4,lineHeight:10});
    drawText(page,font,value("bosManagementInitials"),76,455,{maxWidth:64,size:8});
    drawText(page,font,value("bosBuyerInitials"),225,455,{maxWidth:44,size:8});

    const amounts = [
      ["bosSalePrice",525],["bosTradeValue",511],["bosWarranty",497],["bosDocumentFee",483],["bosSubtotal",469],
      ["bosGst",455],["bosRst",441],["bosTotal",427],["bosDeposit",413],["bosBalance",399]
    ];
    amounts.forEach(([id,y],index) => drawText(page,index === 0 || [4,7].includes(index) ? bold : font,`$${currency(number(id))}`,456,y,{maxWidth:110,size:8.5}));

    drawText(page,font,value("bosTradeYear"),24,326,{maxWidth:72,size:8.5});
    drawText(page,font,value("bosTradeMake"),112,326,{maxWidth:82,size:8.5});
    drawText(page,font,value("bosTradeModel"),202,326,{maxWidth:82,size:8.5});
    drawText(page,font,value("bosTradeVin"),92,297,{maxWidth:160,size:8.5});
    drawText(page,font,value("bosTradeOdometer"),80,269,{maxWidth:170,size:8.5});
    drawText(page,font,value("bosTradeLien"),23,231,{maxWidth:250,size:8,maxLines:3,lineHeight:11});
    drawText(page,font,formatDate(value("bosBuyerSignatureDate")),337,237,{maxWidth:115,size:8.5});
    drawText(page,font,formatDate(value("bosSellerSignatureDate")),337,129,{maxWidth:115,size:8.5});

    if ($("bosIncludeSignature")?.checked) {
      const signatureResponse = await fetch(SIGNATURE_URL,{cache:"no-store"});
      if (!signatureResponse.ok) throw new Error("The dealership signature could not be loaded.");
      const signature = await pdf.embedPng(await signatureResponse.arrayBuffer());
      page.drawImage(signature,{x:325,y:170,width:53,height:21});
    }

    if (treatySale) {
      drawText(page,font,value("bosTreatyNumber"),94,61,{maxWidth:115,size:8.5});
      drawText(page,font,formatDate(value("bosRequestedDeliveryDate")),248,45,{maxWidth:118,size:8.5});
    }

    return pdf.save();
  }

  async function makeBlob() {
    setStatus("Preparing the original bill of sale...");
    const bytes = await createPdf();
    setStatus("Bill of sale ready.");
    return new Blob([bytes], {type:"application/pdf"});
  }

  async function preview() {
    try {
      const blob = await makeBlob();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(blob);
      $("bosPreviewFrame").src = previewUrl;
      $("bosPreviewWrap").hidden = false;
      $("bosPreviewWrap").scrollIntoView({behavior:"smooth",block:"start"});
    } catch (error) { setStatus(error.message); }
  }

  async function download() {
    try {
      const blob = await makeBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `M-O-Motors-${value("bosSaleType") === "treaty" ? "Treaty-" : ""}Bill-of-Sale-${value("bosInvoice") || "draft"}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url),1000);
    } catch (error) { setStatus(error.message); }
  }

  async function printPdf() {
    try {
      const blob = await makeBlob();
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url,"_blank");
      if (!printWindow) throw new Error("Allow pop-ups for this page, then try printing again.");
      setStatus("The original bill of sale opened in a new tab. Use the PDF viewer's Print button.");
      setTimeout(() => URL.revokeObjectURL(url),60000);
    } catch (error) { setStatus(error.message); }
  }

  function init() {
    if (!$("billOfSaleForm")) return;
    resetForm();
    $("bosSaleType")?.addEventListener("change",updateSaleType);
    $("bosVehicleSearch")?.addEventListener("focus",renderVehicleSuggestions);
    $("bosVehicleSearch")?.addEventListener("input",()=>{ set("bosVehicleSelect",""); renderVehicleSuggestions(); });
    $("bosVehicleSearch")?.addEventListener("keydown",event=>moveSuggestion(event,"bosVehicleSuggestions"));
    $("bosVehicleSuggestions")?.addEventListener("click",event=>{ const option=event.target.closest("[data-bos-vehicle]"); if(!option)return; set("bosVehicleSelect",option.dataset.bosVehicle); populateVehicle(); });
    $("bosBuyerAddress")?.addEventListener("input",()=>{ clearTimeout(addressTimer); addressTimer=setTimeout(lookupAddress,650); });
    $("bosBuyerAddress")?.addEventListener("keydown",event=>moveSuggestion(event,"bosAddressSuggestions"));
    $("bosAddressSuggestions")?.addEventListener("click",event=>{ const option=event.target.closest("[data-bos-address]"); if(!option)return; set("bosBuyerAddress",option.dataset.bosAddress); closeSuggestions("bosBuyerAddress","bosAddressSuggestions"); });
    document.addEventListener("click",event=>{ if(!event.target.closest(".bos-vehicle-select"))closeSuggestions("bosVehicleSearch","bosVehicleSuggestions"); if(!event.target.closest("#bosBuyerAddress")&&!event.target.closest("#bosAddressSuggestions"))closeSuggestions("bosBuyerAddress","bosAddressSuggestions"); });
    ["bosSalePrice","bosTradeValue","bosWarranty","bosDocumentFee","bosDeposit"].forEach(id => $(id)?.addEventListener("input",recalculate));
    $("bosRecalculate")?.addEventListener("click",recalculate);
    $("bosReset")?.addEventListener("click",resetForm);
    $("bosPreview")?.addEventListener("click",preview);
    $("bosDownload")?.addEventListener("click",download);
    $("bosPrint")?.addEventListener("click",printPdf);
  }

  window.loadBillOfSaleVehicles = loadVehicles;
  document.addEventListener("DOMContentLoaded",init);
})();
