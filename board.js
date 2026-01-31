<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Officer Board</title>
  <style>
    body { font-family: -apple-system, system-ui, Arial; padding: 14px; }
    h1 { margin: 0 0 10px; }
    input, button { width: 100%; font-size: 18px; padding: 12px; }
    .row { display:flex; gap:10px; margin-top:10px; }
    .row button { flex: 1; }
    .card { border:1px solid #ddd; border-radius:12px; padding:12px; margin-top:10px; }
    .big { font-size: 22px; font-weight: 800; }
    .muted { color:#666; }
    .pill { display:inline-block; padding:4px 10px; border-radius:999px; font-size:14px; border:1px solid #ddd; margin-top:6px; }
  </style>
</head>
<body>
  <h1>Officer Live Board</h1>
  <div class="muted">Read-only. Use Import if you received an updated file.</div>

  <div class="row">
    <button id="importBtn">Import Update</button>
    <button id="refreshBtn">Refresh</button>
  </div>

  <div style="margin-top:12px;">
    <input id="search" maxlength="5" inputmode="numeric" placeholder="Search PO (5 digits)" />
  </div>

  <div id="results"></div>

  <script>
    const STORAGE_KEY = "ledger_rows_v1";
    const search = document.getElementById("search");
    const results = document.getElementById("results");
    const refreshBtn = document.getElementById("refreshBtn");
    const importBtn = document.getElementById("importBtn");

    function loadRows() {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
      catch { return []; }
    }

    function isFiveDigits(v) { return /^[0-9]{5}$/.test(v); }

    function instructionFromRow(r) {
      const door = r.confirmedDoor || r.ledgerDoor || "";
      if (r.status === "Docked" && door) return `Dock at Door ${door}`;
      if (r.status === "Park & Check In") return door ? `Park → run to Door ${door}` : "Park → check in";
      if (r.status === "Rejected") return "Reject – reschedule";
      if (r.status === "Rescheduled") return "Rescheduled – do not dock";
      if (r.status === "Arrived / Checking In") return "Checking in";
      return r.notes || "Await instruction";
    }

    function render() {
      const rows = loadRows();
      const q = (search.value || "").trim();

      // If no PO typed yet, show last 10 updates (useful under traffic)
      const view = q
        ? rows.filter(r => String(r.po || "").includes(q))
        : rows.slice(0, 10);

      if (!view.length) {
        results.innerHTML = "<p class='muted'>No matches.</p>";
        return;
      }

      results.innerHTML = view.map(r => {
        const door = r.confirmedDoor || r.ledgerDoor || "—";
        const updated = r.updatedAt ? new Date(r.updatedAt).toLocaleString() : "";
        return `
          <div class="card">
            <div class="big">PO ${r.po}</div>
            <div class="muted">${r.carrier || ""}</div>
            <div class="pill">${r.status || ""}</div>
            <div style="margin-top:10px;"><b>Instruction:</b> ${instructionFromRow(r)}</div>
            <div style="margin-top:6px;"><b>Door:</b> ${door}</div>
            <div class="muted" style="margin-top:6px;">Updated: ${updated}</div>
          </div>
        `;
      }).join("");
    }

    search.addEventListener("input", render);
    refreshBtn.addEventListener("click", render);

    importBtn.addEventListener("click", () => {
      const inp = document.createElement("input");
      inp.type = "file";
      inp.accept = "application/json";
      inp.onchange = async () => {
        const f = inp.files?.[0];
        if (!f) return;
        const text = await f.text();
        const parsed = JSON.parse(text);
        const incoming = Array.isArray(parsed) ? parsed : (parsed.rows || []);
        if (!Array.isArray(incoming)) return;

        // Merge into local storage
        const current = loadRows();
        const map = new Map(current.map(r => [r.po, r]));
        for (const r of incoming) {
          if (r && r.po && isFiveDigits(String(r.po))) map.set(String(r.po), r);
        }
        const merged = Array.from(map.values()).sort((a,b) => (b.updatedAt||"").localeCompare(a.updatedAt||""));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        render();
      };
      inp.click();
    });

    render();
  </script>
</body>
</html>
<script type="module" src="./board.js"></script>
<link rel="stylesheet" href="./styles.css">
