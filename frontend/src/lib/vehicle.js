// Vehicle helpers: Indian number plate checks, and reading vehicle details from RC text.

const STATES = {
  AN: "Andaman & Nicobar", AP: "Andhra Pradesh", AR: "Arunachal Pradesh", AS: "Assam", BR: "Bihar",
  CG: "Chhattisgarh", CH: "Chandigarh", DD: "Daman & Diu", DL: "Delhi", DN: "Dadra & Nagar Haveli",
  GA: "Goa", GJ: "Gujarat", HP: "Himachal Pradesh", HR: "Haryana", JH: "Jharkhand", JK: "Jammu & Kashmir",
  KA: "Karnataka", KL: "Kerala", LA: "Ladakh", LD: "Lakshadweep", MH: "Maharashtra", ML: "Meghalaya",
  MN: "Manipur", MP: "Madhya Pradesh", MZ: "Mizoram", NL: "Nagaland", OD: "Odisha", OR: "Odisha",
  PB: "Punjab", PY: "Puducherry", RJ: "Rajasthan", SK: "Sikkim", TN: "Tamil Nadu", TR: "Tripura",
  TS: "Telangana", UA: "Uttarakhand", UK: "Uttarakhand", UP: "Uttar Pradesh", WB: "West Bengal",
};

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const NORMAL = /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}$/; // KL34B3211
const BHARAT = /^\d{2}BH\d{4}[A-Z]{1,2}$/; // 22BH1234AA

// "kl 34 b-3211" -> "KL34B3211"
export const normalizePlate = (text) => text.toUpperCase().replace(/[^A-Z0-9]/g, "");

export function isPlate(text) {
  const plate = normalizePlate(text);
  return BHARAT.test(plate) || (NORMAL.test(plate) && plate.slice(0, 2) in STATES);
}

// "KL34B3211" -> "Kerala", "22BH1234AA" -> "Bharat series", otherwise null
export function plateRegion(text) {
  const plate = normalizePlate(text);
  if (BHARAT.test(plate)) return "Bharat series";
  return isPlate(plate) ? STATES[plate.slice(0, 2)] : null;
}

// Popular models in India, for suggestions while typing. Any name can still be typed.
export const MODELS = {
  bike: [
    "Bajaj Pulsar 150", "Bajaj Pulsar N160", "Bajaj Pulsar NS200", "Bajaj Platina", "Hero Splendor Plus", "Hero HF Deluxe",
    "Hero Glamour", "Honda Activa 6G", "Honda Shine", "Honda Unicorn", "Honda Dio", "TVS Jupiter", "TVS Apache RTR 160",
    "TVS Raider 125", "TVS Ntorq 125", "Royal Enfield Classic 350", "Royal Enfield Bullet 350", "Royal Enfield Hunter 350",
    "Royal Enfield Himalayan", "Yamaha FZ-S", "Yamaha R15", "Yamaha MT-15", "Suzuki Access 125", "Ola S1 Pro", "Ather 450X",
    "KTM Duke 200",
  ],
  car: [
    "Maruti Suzuki Swift", "Maruti Suzuki Baleno", "Maruti Suzuki Dzire", "Maruti Suzuki Wagon R", "Maruti Suzuki Alto",
    "Maruti Suzuki Brezza", "Maruti Suzuki Ertiga", "Hyundai i20", "Hyundai Creta", "Hyundai Venue", "Hyundai Verna",
    "Hyundai Grand i10 Nios", "Tata Nexon", "Tata Punch", "Tata Tiago", "Tata Altroz", "Mahindra XUV700", "Mahindra Scorpio-N",
    "Mahindra Thar", "Kia Seltos", "Kia Sonet", "Honda City", "Honda Amaze", "Toyota Innova Crysta", "Toyota Glanza",
    "MG Hector", "Renault Kwid", "Skoda Kushaq", "Volkswagen Virtus",
  ],
};

export function suggestModels(type, typed, limit = 4) {
  const q = typed.trim().toLowerCase();
  if (q.length < 2) return [];
  return (MODELS[type] ?? []).filter((m) => m.toLowerCase().includes(q) && m.toLowerCase() !== q).slice(0, limit);
}

// ---------- Reading an RC ----------

// Words that are company suffixes, not part of the brand name ("BAJAJ AUTO LTD" -> "Bajaj").
const NOT_BRAND = new Set(["AUTO", "MOTOR", "MOTORS", "MOTORCYCLE", "MOTORCYCLES", "MOTOCORP", "INDIA", "PVT", "PRIVATE",
  "LTD", "LTD.", "LIMITED", "AND", "&", "CORPORATION", "CORP", "CO", "COMPANY", "SCOOTER", "CARS", "KIRLOSKAR", "TWO", "WHEELERS"]);
const MONTH_SHORT = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

// Value written after a label on the same line ("Colour: SILVER"), or on the next line.
function valueAfter(lines, label) {
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(label);
    if (!match) continue;
    const rest = lines[i].slice(match.index + match[0].length).replace(/^[\s:.\-–|]+/, "").trim();
    return rest || (lines[i + 1] ?? "").trim();
  }
  return "";
}

// "PULSAR 150 DTSI" -> "Pulsar 150 Dtsi"; short or numbered codes stay upper case ("VXI", "i20" -> "I20").
const titleCase = (text) =>
  text.split(/\s+/).filter(Boolean)
    .map((w) => (/\d/.test(w) || w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");

function brandOf(maker) {
  const words = maker.toUpperCase().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  return words[1] && !NOT_BRAND.has(words[1]) ? `${words[0]} ${words[1]}` : words[0];
}

function findPlate(lines) {
  const labelled = valueAfter(lines, /\b(regn|registration|reg)\.?\s*(no|number|num)?\b/i);
  if (isPlate(labelled)) return normalizePlate(labelled);
  for (const line of lines) if (isPlate(line)) return normalizePlate(line);
  // Plate inside a longer line; the state code check stops chassis numbers matching.
  for (const line of lines) {
    for (const m of normalizePlate(line).matchAll(/\d{2}BH\d{4}[A-Z]{1,2}|[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}/g)) {
      if (isPlate(m[0])) return m[0];
    }
  }
  return null;
}

function findMfg(lines) {
  const i = lines.findIndex((l) => /\bmfg\b|month\s*(and|&|\/)?\s*year|year\s*of\s*manufactur|manufactur\w*\s*(date|month|year)/i.test(l));
  if (i < 0) return { mfgMonth: null, mfgYear: null };
  // The date can be on the label line ("Mfg: 02/2012") or the next one ("MFG DT" / "FEB-2019").
  const text = `${lines[i]} ${lines[i + 1] ?? ""}`.toUpperCase();
  let m = text.match(/\b(0?[1-9]|1[0-2])\s*[/\-.]\s*((?:19|20)\d{2})\b/);
  if (m) return { mfgMonth: Number(m[1]), mfgYear: Number(m[2]) };
  m = text.match(new RegExp(`\\b(${MONTH_SHORT.join("|")})[A-Z]*[\\s\\-/.,]*((?:19|20)\\d{2})\\b`));
  if (m) return { mfgMonth: MONTH_SHORT.indexOf(m[1]) + 1, mfgYear: Number(m[2]) };
  return { mfgMonth: null, mfgYear: null };
}

// lines = text from the OCR (each item may hold several lines).
// Returns { number, model, mfgMonth, mfgYear, colour }; anything not found is null.
export function parseRc(texts) {
  const lines = texts.flatMap((t) => t.split("\n")).map((l) => l.trim()).filter(Boolean);
  const maker = valueAfter(lines, /\bmaker'?s?\s*(name)?\b|\bmfr\b|\bmanufacturer\b(?!\s*(date|month|year))/i);
  const modelLine = lines.find((l) => /\bmodel\b/i.test(l)) ?? "";
  let model = valueAfter(lines, /\bmodel\s*(name)?\b/i);
  // "Maker / Model: BAJAJ PULSAR 150" already holds the full name.
  if (/maker/i.test(modelLine)) model = valueAfter(lines, /maker\s*[/&]?\s*model\b/i) || model;
  const brand = brandOf(maker);
  const full = brand && model && !model.toUpperCase().startsWith(brand) ? `${brand} ${model}` : model;
  const colour = valueAfter(lines, /\bcolou?r\b/i);
  return {
    number: findPlate(lines),
    model: full ? titleCase(full) : null,
    ...findMfg(lines),
    colour: colour ? titleCase(colour) : null,
  };
}
