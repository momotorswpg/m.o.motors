(() => {
  const TEMPLATE_URL = "/assets/documents/mo-motors-bill-of-sale-template.pdf";
  const $ = id => document.getElementById(id);
  const moneyIds = ["bosSalePrice","bosTradeValue","bosWarranty","bosDocumentFee","bosSubtotal","bosGst","bosRst","bosTotal","bosDeposit","bosBalance"];
  let vehicles = [];
  let loaded = false;
  let previewUrl = "";

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

  function recalculate() {
    const subtotal = round(number("bosSalePrice") - number("bosTradeValue") + number("bosWarranty") + number("bosDocumentFee"));
    const gst = round(subtotal * .05);
    const rst = round(subtotal * .07);
    const total = round(subtotal + gst + rst);
    set("bosSubtotal", subtotal.toFixed(2));
    set("bosGst", gst.toFixed(2));
    set("bosRst", rst.toFixed(2));
    set("bosTotal", total.toFixed(2));
    set("bosBalance", round(total - number("bosDeposit")).toFixed(2));
  }

  function resetForm() {
    $("billOfSaleForm")?.reset();
    const today = new Date();
    const iso = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0,10);
    set("bosDateSold", iso);
    set("bosInvoice", `MO-${iso.replaceAll("-","")}`);
    moneyIds.forEach(id => set(id, "0.00"));
    setStatus("");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = "";
    if ($("bosPreviewWrap")) $("bosPreviewWrap").hidden = true;
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
    recalculate();
  }

  async function loadVehicles() {
    const select = $("bosVehicleSelect");
    if (!select || typeof db === "undefined" || loaded) return;
    setStatus("Loading inventory...");
    try {
      const {data,error} = await db.from("Vehicles").select("*").order("created_at", {ascending:false});
      if (error) throw error;
      vehicles = data || [];
      select.innerHTML = '<option value="">Choose a vehicle</option>' + vehicles.map(vehicle => {
        const title = `${vehicle.Year ?? vehicle.year ?? ""} ${vehicle.Make ?? vehicle.make ?? ""} ${vehicle.Model ?? vehicle.model ?? ""}`.trim();
        const vin = vehicle.VIN ?? vehicle.vin ?? "No VIN";
        return `<option value="${escapeHtml(vehicle.id)}">${escapeHtml(title)} - ${escapeHtml(vin)}</option>`;
      }).join("");
      loaded = true;
      setStatus(vehicles.length ? `${vehicles.length} inventory vehicles available.` : "No inventory vehicles found.");
    } catch (error) {
      console.error(error);
      setStatus(`Could not load inventory: ${error.message}`);
    }
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
    if (!value("bosVin") || !value("bosBuyerName") || !value("bosDateSold") || !value("bosInvoice")) throw new Error("Complete the invoice number, date sold, buyer name and vehicle information first.");
    const response = await fetch(TEMPLATE_URL, {cache:"no-store"});
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
      link.download = `M-O-Motors-Bill-of-Sale-${value("bosInvoice") || "draft"}.pdf`;
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
    $("bosVehicleSelect")?.addEventListener("change",populateVehicle);
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
