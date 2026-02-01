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
const clearBtn = document.getElementById("clearBtn");

const poEl = document.getElementById("po");
const carrierEl = document.getElementById("carrier");
const shipperEl = document.getElementById("shipper");
const deptEl = document.getElementById("department");
const ledgerDoorEl = document.getElementById("ledgerDoor");
const notesEl = document.getElementById("notes");

let lastRows = [];

function isFiveDigits(v) { return /^\d{5}$/.test(v); }

function checkinDoorForDept(dept) {
  if (!dept) return null;
  const d = String(dept).toLowerCase().trim();
  if (d === "grocery") return "56";
  if (d === "produce/dairy" || d === "produce" || d === "dairy") return "93";
  if (d === "meat/frozen" || d === "meat frozen" || d === "meat&frozen" || d === "meat/frozen") return "132";
  return null;
}

function instructionFromRow(r) {
  if (r.status === "Checked In") return "Checked in — handoff complete";

  if (r.ledger_door && String(r.ledger_door).trim() !== "") {
    return `Queue — use Ledger Door ${r.ledger_door}`;
  }

  const checkin = checkinDoorForDept(r.department);
  if (checkin) return `Queue — check in at Door ${checkin} (${r.department})`;

  return "Queue — no ledger door; department required";
}

function clearForm() {
  poEl.value = "";
  carrierEl.value = "";
  shipperEl.value = "";
  deptEl.value = "";
  ledgerDoorEl.value = "";
  notesEl.value = "";
  msg.textContent = "";
}

clearBtn.addEventListener("click", clearForm);

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
          <th>Dept</th>
          <th>Carrier</th>
          <th>Status</th>
          <th>Instruction</th>
          <th>Ledger Door</th>
          <th>Updated</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${view.map(r => `
          <tr>
            <td><b>${r.po_number}</b></td>
            <td>${r.department || ""}</td>
            <td>${r.carrier || ""}</td>
            <td>${r.status || ""}</td>
            <td>${instructionFromRow(r)}${r.notes ? ` — ${r.notes}` : ""}</td>
            <td>${r.ledger_door || "—"}</td>
            <td>${r.last_updated ? new Date(r.last_updated).toLocaleString() : ""}</td>
            <td>
              <button data-edit="${r.po_number}">Edit</button>
            </td>
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
    .select("po_number, department, carrier, shipper, ledger_door, status, notes, last_updated")
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

tableWrap.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const editPo = btn.getAttribute("data-edit");
  if (!editPo) return;

  const r = lastRows.find(x => String(x.po_number) === String(editPo));
  if (!r) return;

  // Load into form for correction
  poEl.value = r.po_number || "";
  carrierEl.value = r.carrier || "";
  shipperEl.value = r.shipper || "";
  deptEl.value = r.department || "";
  ledgerDoorEl.value = r.ledger_door || "";
  notesEl.value = r.notes || "";
  msg.textContent = "Loaded for editing. Make changes → Save/Update.";
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.textContent = "";

  const po = poEl.value.trim();
  if (!isFiveDigits(po)) {
    msg.textContent = "PO must be exactly 5 digits.";
    return;
  }

  const department = deptEl.value;
  if (!department) {
    msg.textContent = "Department is required.";
    return;
  }

  // STATUS RULE: Admin always keeps Queue. Officers flip to Checked In.
  const payload = {
    po_number: po,
    carrier: carrierEl.value.trim() || null,
    shipper: shipperEl.value.trim() || null,
    department,
    ledger_door: ledgerDoorEl.value.trim() || null,
    notes: notesEl.value.trim() || null,
    status: "Queue",
    door_source: (ledgerDoorEl.value.trim() ? "Warehouse Ledger" : "Not Provided"),
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

  msg.textContent = "Saved (Queue).";
  form.reset();
  await loadRows();
});

loadRows();
