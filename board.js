import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://pxiigthkswhnivanndfn.supabase.co";
const SUPABASE_KEY = "sb_publishable_fWVXeZM0mcylqczc6DWztA_Fu63kfj0";
const PIN = "2050";

const entered = prompt("Enter PIN");
if ((entered || "").trim() !== PIN) {
  document.body.innerHTML = "<h2 style='font-family:system-ui;padding:16px'>Wrong PIN</h2>";
  throw new Error("Wrong PIN");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const search = document.getElementById("search");
const results = document.getElementById("results");

let lastRows = [];

function instructionFromRow(r) {
  if (r.status === "Checked In") return "Checked in — handoff complete";
  if (r.ledger_door) return `Queue — ledger door listed: ${r.ledger_door}`;
  return "Queue — await warehouse intake";
}

function render() {
  const q = (search.value || "").trim();
  const view = q
    ? lastRows.filter(r => String(r.po_number || "").includes(q))
    : lastRows.slice(0, 12);

  if (!view.length) {
    results.innerHTML = "<p class='muted'>No matches.</p>";
    return;
  }

  results.innerHTML = view.map(r => `
    <div class="card">
      <div class="big">PO ${r.po_number}</div>
      <div class="muted">${r.carrier || ""}</div>
      <div class="pill">${r.status || ""}</div>
      <div style="margin-top:10px;"><b>Instruction:</b> ${instructionFromRow(r)}${r.notes ? ` — ${r.notes}` : ""}</div>
      <div style="margin-top:6px;"><b>Ledger Door:</b> ${r.ledger_door || "—"}</div>
      <div class="muted" style="margin-top:6px;">Updated: ${r.last_updated ? new Date(r.last_updated).toLocaleString() : ""}</div>
    </div>
  `).join("");
}

async function loadRows() {
  const { data, error } = await supabase
    .from("trucks")
    .select("po_number, carrier, ledger_door, status, notes, last_updated")
    .order("last_updated", { ascending: false });

  if (error) {
    results.innerHTML = `<p class="muted">Load error: ${error.message}</p>`;
    return;
  }

  lastRows = data || [];
  render();
}

search.addEventListener("input", render);
loadRows();
