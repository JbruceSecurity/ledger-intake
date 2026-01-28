import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_KEY, APP_PIN } from "./config.js";
const supabaseKey = SUPABASE_KEY

console.log(supabaseKey)

const supabase = createClient(SUPABASE_URL, supabaseKey);

// PIN gate
const gate = document.getElementById("gate");
const app = document.getElementById("app");
const pin = document.getElementById("pin");
const unlock = document.getElementById("unlock");
const pinMsg = document.getElementById("pinMsg");

function setUnlocked(v) {
  sessionStorage.setItem("unlocked", v ? "yes" : "no");
}
function isUnlocked() {
  return sessionStorage.getItem("unlocked") === "yes";
}
function showApp() {
  gate.classList.add("hidden");
  app.classList.remove("hidden");
}
function showGate() {
  gate.classList.remove("hidden");
  app.classList.add("hidden");
}

unlock.addEventListener("click", () => {
  if ((pin.value || "").trim() === APP_PIN) {
    setUnlocked(true);
    pinMsg.textContent = "";
    showApp();
  } else {
    pinMsg.textContent = "Wrong PIN.";
  }
});

if (isUnlocked()) showApp();

// App UI
const poInput = document.getElementById("po");
const searchBtn = document.getElementById("searchBtn");
const resetBtn = document.getElementById("resetBtn");
const msg = document.getElementById("msg");
const result = document.getElementById("result");

const instructionCard = document.getElementById("instruction");
const instructionText = document.getElementById("instructionText");

function isFiveDigits(v) {
  return /^[0-9]{5}$/.test(v);
}

function doorFromRow(r) {
  return (r.confirmed_door || r.ledger_door || "").trim();
}

function renderRow(r) {
  const door = doorFromRow(r) || "—";
  const checked = r.status === "Checked In";
  result.classList.remove("hidden");
  instructionCard.classList.add("hidden");

  result.innerHTML = `
    <div class="big">PO ${r.po_number}</div>
    <div class="muted">${r.carrier || ""} ${r.shipper ? "• " + r.shipper : ""}</div>
    <div style="margin-top:8px;"><b>Status:</b> ${r.status}</div>
    <div style="margin-top:6px;"><b>Door:</b> ${door}</div>
    <button id="checkInBtn" style="margin-top:12px;" ${checked ? "disabled" : ""}>
      ${checked ? "Already Checked In" : "Check In"}
    </button>
  `;

  document.getElementById("checkInBtn").addEventListener("click", async () => {
    msg.textContent = "Checking in…";
    try {
      const { data, error } = await supabase.rpc("check_in", { po: r.po_number });
      if (error) throw error;

      const out = Array.isArray(data) ? data[0] : data;
      msg.textContent = "";

      instructionCard.classList.remove("hidden");
      instructionText.innerHTML = `<span class="ok">${out.instruction}</span>`;

      // Refresh displayed row so status flips to Checked In
      await doSearch(r.po_number);
    } catch (e) {
      msg.textContent = `Check-in failed: ${e.message}`;
    }
  });
}

async function doSearch(po) {
  msg.textContent = "Searching…";
  result.classList.add("hidden");
  instructionCard.classList.add("hidden");

  const { data, error } = await supabase
    .from("trucks")
    .select("po_number, carrier, shipper, ledger_door, confirmed_door, status")
    .eq("po_number", po)
    .maybeSingle();

  if (error) {
    msg.textContent = `Search error: ${error.message}`;
    return;
  }
  if (!data) {
    msg.textContent = "PO not found.";
    return;
  }

  msg.textContent = "";
  console.log (data)
  renderRow(data);
}

searchBtn.addEventListener("click", () => {
  const po = (poInput.value || "").trim();
  if (!isFiveDigits(po)) return (msg.textContent = "PO must be exactly 5 digits.");
  doSearch(po);
});

poInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") searchBtn.click();
});

resetBtn.addEventListener("click", () => {
  poInput.value = "";
  msg.textContent = "";
  result.classList.add("hidden");
  instructionCard.classList.add("hidden");
});

