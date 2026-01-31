alert("app.js running");	
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://pxiigthkswhnivanndfn.supabase.co";
const SUPABASE_KEY = "sb_publishable_fWVXeZM0mcylqczc6DWztA_Fu63kfj0";

// Speed-bump PIN (not true security)
const PIN = "2050";
const entered = prompt("Enter PIN");
if ((entered || "").trim() !== PIN) {
  document.body.innerHTML = "<h2 style='font-family:system-ui;padding:16px'>Wrong PIN</h2>";
  throw new Error("Wrong PIN");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// DOM
const form = document.getElementById("form");
const msg = document.getElementById("msg");
const tableWrap = document.getElementById("tableWrap");
const search = document.getElementById("search");

let lastRows = [];

function isFiveDigits(v) { return /^\d{5}$/.test(v); }

function instructionFromRow(r) {
  if (r.status === "Checked In") return "Checked in — handoff complete";
  // Queue
  if (r.ledger_door) return `Queue — use ledger door if instructed (${r.ledger_door})`;
  return "Queue — await warehouse intake";
}

function render(rows) {
  const q = (search.value || "").trim();
  const view = q ? rows.filter(r => String(r.po_number || "").includes(q)) : rows;

  if (!view.length) {
    tableWrap.innerHTML = "<p class='muted'>No rows yet.</p>";
    return;
  }

  tableWrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>PO</th>
          <th>Carrier</th>
          <th>Status</th>
          <th>Instruction</th>
          <th>Ledger Door</th>
          <th>Updated</th>
        </tr>
      </thead>
      <tbody>
        ${view.map(r => `
          <tr>
            <td><b>${r.po_number}</b></td>
            <td>${r.carrier || ""}</td>
            <td>${r.status || ""}</td>
            <td>${instructionFromRow(r)}${r.notes ? ` — ${r.notes}` : ""}</td>
            <td>${r.ledger_door || "—"}</td>
            <td>${r.last_updated ? new Date(r.last_updated).toLocaleString() : ""}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

async function loadRows() {
  msg.textContent = "Loading…";
  const { data, error } = await supabase
    .from("trucks")
    .select("po_number, carrier, shipper, ledger_door, status, notes, last_updated")
    .order("last_updated", { ascending: false });

  if (error) {
    msg.textContent = `Load error: ${error.message}`;
    return;
  }

  msg.textContent = "";
  lastRows = data || [];
  render(lastRows);
}

search.addEventListener("input", () => render(lastRows));

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.textContent = "";

  const po = document.getElementById("po").value.trim();
  if (!isFiveDigits(po)) {
    msg.textContent = "PO must be exactly 5 digits.";
    return;
  }

  const payload = {
    po_number: po,
    carrier: document.getElementById("carrier").value.trim() || null,
    shipper: document.getElementById("shipper").value.trim() || null,
    ledger_door: document.getElementById("ledgerDoor").value.trim() || null,
    status: document.getElementById("status").value,
    notes: document.getElementById("notes").value.trim() || null,
    door_source: (document.getElementById("ledgerDoor").value.trim() ? "Warehouse Ledger" : "Not Provided"),
    updated_by: "Jessie Bruce"
  };

  msg.textContent = "Saving…";
  const { error } = await supabase
    .from("trucks")
    .upsert(payload, { onConflict: "po_number" });

  if (error) {
    msg.textContent = `Save error: ${error.message}`;
    return;
  }

  msg.textContent = "Saved.";
  form.reset();
  await loadRows();
});

loadRows();
