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

  return "Queue — no ledger door; select department on admin";
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

  results.innerHTML = view.map(r => {
    const updated = r.last_updated ? new Date(r.last_updated).toLocaleString() : "";
    return `
      <div class="card">
        <div class="big">PO ${r.po_number}</div>
        <div class="muted">${r.carrier || ""}</div>

        <div class="pill">${r.department || "—"}</div>
        <div class="pill">${r.status || ""}</div>

        <div style="margin-top:10px;"><b>Instruction:</b> ${instructionFromRow(r)}${r.notes ? ` — ${r.notes}` : ""}</div>
        <div class="muted" style="margin-top:8px;">Updated: ${updated}</div>

        <div class="btnrow">
          <button data-checkin="${r.po_number}">Mark Checked In</button>
          <button data-queue="${r.po_number}">Back to Queue</button>
        </div>
      </div>
    `;
  }).join("");
}

async function loadRows() {
  const { data, error } = await supabase
    .from("trucks")
    .select("po_number, department, carrier, ledger_door, status, notes, last_updated")
    .order("last_updated", { ascending: false });

  if (error) {
    results.innerHTML = `<p class="muted">Load error: ${error.message}</p>`;
    return;
  }

  lastRows = data || [];
  render();
}

search.addEventListener("input", render);

results.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const poCheckin = btn.getAttribute("data-checkin");
  const poQueue = btn.getAttribute("data-queue");

  const po = poCheckin || poQueue;
  if (!po) return;

  const newStatus = poCheckin ? "Checked In" : "Queue";

  const { error } = await supabase
    .from("trucks")
    .update({
      status: newStatus,
      updated_by: "Officer"
    })
    .eq("po_number", po);

  if (error) {
    alert(`Update failed: ${error.message}`);
    return;
  }

  await loadRows();
});

loadRows();
