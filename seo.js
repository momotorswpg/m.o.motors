(() => {
  const site = "https://www.momotors.ca";
  const path = location.pathname.split("/").pop() || "index.html";
  const pages = {
    "index.html": ["Used Vehicles in Winnipeg | M.O Motors", "Shop quality used and pre-owned vehicles in Winnipeg at M.O Motors. Browse our inventory, value your trade, explore financing and book a test drive."],
    "inventory.html": ["Used Vehicle Inventory in Winnipeg | M.O Motors", "Browse used cars, SUVs, trucks and vans for sale in Winnipeg. View current pre-owned inventory, pricing, photos and payment estimates from M.O Motors."],
    "vehicle.html": ["Used Vehicle for Sale in Winnipeg | M.O Motors", "View pricing, photos, specifications and purchase options for this pre-owned vehicle at M.O Motors in Winnipeg."],
    "pre-approval.html": ["Used Car Financing Pre-Approval Winnipeg | M.O Motors", "Apply online for used vehicle financing pre-approval in Winnipeg. M.O Motors offers a simple application for a range of credit situations."],
    "payment-estimator.html": ["Used Car Payment Calculator Winnipeg | M.O Motors", "Estimate payments for a used vehicle in Winnipeg. Adjust the vehicle price, down payment, trade-in, term, rate, fees and warranty."],
    "warranty.html": ["Used Vehicle Warranty Options Winnipeg | M.O Motors", "Explore optional protection plans for used cars, SUVs, trucks, vans and electric vehicles available through M.O Motors in Winnipeg."],
    "trade-in.html": ["Sell or Trade Your Car in Winnipeg | M.O Motors", "Request an offer to sell, trade or consign your vehicle with M.O Motors in Winnipeg. Submit your vehicle details online."],
    "book-test-drive.html": ["Book a Used Vehicle Test Drive Winnipeg | M.O Motors", "Book a test drive for a used car, SUV, truck or van at M.O Motors in Winnipeg."],
    "vehicle-sourcing.html": ["Used Vehicle Sourcing Service Winnipeg | M.O Motors", "Tell M.O Motors what used vehicle you want and let our Winnipeg dealership search its dealer and auction network for suitable options."],
    "service-repairs.html": ["Vehicle Service and Repair Referrals Winnipeg | M.O Motors", "Request an estimate for common vehicle maintenance and repairs through M.O Motors and its Winnipeg service partner."],
    "referral.html": ["Customer Referral Rewards | M.O Motors Winnipeg", "Refer a friend or family member shopping for a used vehicle in Winnipeg and register the referral with M.O Motors."],
    "financing.html": ["Used Car Financing Winnipeg | M.O Motors", "Explore used vehicle financing options and apply for pre-approval with M.O Motors in Winnipeg."]
  };
  const page = pages[path];
  if (!page) return;

  const ensureMeta = (selector, attributes) => {
    let node = document.head.querySelector(selector);
    if (!node) {
      node = document.createElement("meta");
      document.head.appendChild(node);
    }
    Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, value));
    return node;
  };
  const ensureLink = (rel, href) => {
    let node = document.head.querySelector(`link[rel="${rel}"]`);
    if (!node) {
      node = document.createElement("link");
      node.rel = rel;
      document.head.appendChild(node);
    }
    node.href = href;
  };
  const canonicalPath = path === "index.html" ? "/" : `/${path}`;
  const canonical = `${site}${canonicalPath}${path === "vehicle.html" && new URLSearchParams(location.search).get("id") ? `?id=${encodeURIComponent(new URLSearchParams(location.search).get("id"))}` : ""}`;
  document.title = page[0];
  ensureMeta('meta[name="description"]', { name:"description", content:page[1] });
  ensureMeta('meta[name="robots"]', { name:"robots", content:"index,follow,max-image-preview:large" });
  ensureMeta('meta[property="og:type"]', { property:"og:type", content:path === "vehicle.html" ? "product" : "website" });
  ensureMeta('meta[property="og:site_name"]', { property:"og:site_name", content:"M.O Motors" });
  ensureMeta('meta[property="og:title"]', { property:"og:title", content:page[0] });
  ensureMeta('meta[property="og:description"]', { property:"og:description", content:page[1] });
  ensureMeta('meta[property="og:url"]', { property:"og:url", content:canonical });
  ensureMeta('meta[property="og:image"]', { property:"og:image", content:`${site}/mo-motors-logo.png` });
  ensureMeta('meta[name="twitter:card"]', { name:"twitter:card", content:"summary_large_image" });
  ensureMeta('meta[name="twitter:title"]', { name:"twitter:title", content:page[0] });
  ensureMeta('meta[name="twitter:description"]', { name:"twitter:description", content:page[1] });
  ensureLink("canonical", canonical);

  const localBusiness = {
    "@context":"https://schema.org",
    "@type":"AutoDealer",
    "@id":`${site}/#dealership`,
    name:"M.O Motors",
    url:`${site}/`,
    logo:`${site}/mo-motors-logo.png`,
    image:`${site}/mo-motors-logo.png`,
    telephone:"+1-204-963-4462",
    priceRange:"$$",
    address:{"@type":"PostalAddress",streetAddress:"Unit 104, 420 Des Meurons St",addressLocality:"Winnipeg",addressRegion:"MB",postalCode:"R2H 2N9",addressCountry:"CA"},
    areaServed:{"@type":"City",name:"Winnipeg"},
    openingHoursSpecification:[{"@type":"OpeningHoursSpecification",dayOfWeek:["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],opens:"12:00",closes:"18:00"}],
    sameAs:[]
  };
  let schema = document.getElementById("localBusinessSchema");
  if (!schema) {
    schema = document.createElement("script");
    schema.id = "localBusinessSchema";
    schema.type = "application/ld+json";
    document.head.appendChild(schema);
  }
  schema.textContent = JSON.stringify(localBusiness);

  window.updateVehicleSeo = (vehicle, photos = []) => {
    const name = [vehicle.Year, vehicle.Make, vehicle.Model, vehicle.Trim].filter(Boolean).join(" ");
    const title = `${name} Used for Sale in Winnipeg | M.O Motors`;
    const mileage = vehicle.Mileage ? ` with ${Number(vehicle.Mileage).toLocaleString("en-CA")} km` : "";
    const description = `View this ${name}${mileage} at M.O Motors in Winnipeg. See photos, specifications, price and financing options.`;
    document.title = title;
    ensureMeta('meta[name="description"]', { name:"description", content:description });
    ensureMeta('meta[property="og:title"]', { property:"og:title", content:title });
    ensureMeta('meta[property="og:description"]', { property:"og:description", content:description });
    if (photos[0]?.image_url) ensureMeta('meta[property="og:image"]', { property:"og:image", content:photos[0].image_url });
    const product = document.createElement("script");
    product.id = "vehicleProductSchema";
    product.type = "application/ld+json";
    product.textContent = JSON.stringify({
      "@context":"https://schema.org",
      "@type":"Vehicle",
      name,
      url:canonical,
      image:photos.map(photo => photo.image_url).filter(Boolean),
      vehicleIdentificationNumber:vehicle.VIN || undefined,
      mileageFromOdometer:vehicle.Mileage ? {"@type":"QuantitativeValue",value:Number(vehicle.Mileage),unitCode:"KMT"} : undefined,
      vehicleModelDate:vehicle.Year ? String(vehicle.Year) : undefined,
      manufacturer:vehicle.Make ? {"@type":"Organization",name:vehicle.Make} : undefined,
      model:vehicle.Model || undefined,
      offers:{"@type":"Offer",price:Number(vehicle.Price || 0),priceCurrency:"CAD",availability:String(vehicle.Status || "").toLowerCase() === "sold" ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",url:canonical,seller:{"@id":`${site}/#dealership`}}
    });
    document.getElementById("vehicleProductSchema")?.remove();
    document.head.appendChild(product);
  };
})();
