from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter()


@router.get("/memory-test", response_class=HTMLResponse)
async def memory_test_page():
    html = """
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Mira Memory Test</title>
    <style>
      body { font-family: system-ui, Arial, sans-serif; max-width:900px; margin:18px auto; padding:12px; }
      input, textarea { width:100%; padding:8px; margin:6px 0 12px; }
      button { padding:8px 12px; margin-right:8px; }
      pre { background:#f3f4f6; padding:12px; border-radius:6px; overflow:auto }
      .row { display:grid; grid-template-columns:1fr 1fr; gap:12px }
    </style>
  </head>
  <body>
    <h2>Mira — Memory Test</h2>
    <p>Use this page to test per-user memory and the text-query pipeline.</p>

  <!-- Dev user id removed: use real auth or debug endpoints with explicit user_id -->

    <div class="row">
      <div>
        <label>Fact to add</label>
        <textarea id="fact" rows="3" placeholder="e.g. Prefers tea over coffee"></textarea>
        <button id="btnAddFact">Add Fact</button>
      </div>
      <div>
        <label>Query / Prompt</label>
        <textarea id="query" rows="3" placeholder="e.g. What does the user drink in the morning?"></textarea>
        <button id="btnGetContext">Get Context</button>
        <button id="btnTextQuery">Send Text-Query</button>
      </div>
    </div>

    <label>Optional Authorization (Bearer token)</label>
    <input id="auth" placeholder="Bearer <token> (optional for /text-query)" />

    <h3>Results</h3>
    <pre id="out">Ready</pre>

    <script>
  const out = document.getElementById('out');
  const authEl = document.getElementById('auth');

      async function postJson(url, body, auth) {
        const headers = { 'Content-Type': 'application/json' };
        if (auth) headers['Authorization'] = auth;
        const res = await fetch(url, { method:'POST', headers, body: JSON.stringify(body) });
        const text = await res.text();
        try { return JSON.parse(text); } catch(e) { return text; }
      }

      document.getElementById('btnAddFact').onclick = async () => {
        out.textContent = 'Adding fact...';
  const payload = { user_id: null, fact: document.getElementById('fact').value || '' };
        const res = await postJson('/api/memory/add_fact', payload);
        out.textContent = JSON.stringify(res, null, 2);
      };

      document.getElementById('btnGetContext').onclick = async () => {
        out.textContent = 'Fetching context...';
  const payload = { user_id: null, query: document.getElementById('query').value || '', max: 5 };
        const res = await postJson('/api/memory/get_context', payload);
        out.textContent = JSON.stringify(res, null, 2);
      };

      document.getElementById('btnTextQuery').onclick = async () => {
        out.textContent = 'Sending text query...';
  const payload = { query: document.getElementById('query').value || '', history: [] };
        const auth = authEl.value ? authEl.value.trim() : undefined;
        const headers = { 'Content-Type': 'application/json' };
        if (auth) headers['Authorization'] = auth;
        const res = await fetch('/api/text-query', { method:'POST', headers, body: JSON.stringify(payload) });
        const data = await res.json();
        out.textContent = JSON.stringify(data, null, 2);
      };
    </script>
  </body>
</html>
"""
    return HTMLResponse(content=html)
