// public/embed.js
(function () {
  const script = document.currentScript;
  const companyId = script?.dataset?.company || "demo-company";
  const transport = (script?.dataset?.transport || "poll").toLowerCase(); // "poll" | "ws"
  const apiBase = script?.dataset?.api || "http://localhost:3000";
  const widgetPosition = (script?.dataset?.position || "bottom-right").toLowerCase(); // "bottom-right" | "bottom-left" | "top-right" | "top-left" | "bottom-center"

  // Create/remember a visitorId
  const VISITOR_KEY = "embed_demo_visitor_id";
  let visitorId = localStorage.getItem(VISITOR_KEY);
  if (!visitorId) {
    visitorId = "v_" + Math.random().toString(36).slice(2);
    localStorage.setItem(VISITOR_KEY, visitorId);
  }

  // UI
  const bubble = document.createElement("button");
  bubble.textContent = "Chat";

  const panel = document.createElement("div");
  panel.innerHTML = `
    <div style="font-weight:600; margin-bottom:8px;">Demo Embed (${transport.toUpperCase()})</div>
    <div id="msgs" style="overflow:auto; height:280px; border:1px solid #eee; border-radius:8px; padding:8px; margin-bottom:8px;"></div>
    <form id="f" style="display:flex; gap:8px;">
      <input id="t" placeholder="Type a message..." style="flex:1; padding:8px; border:1px solid #ddd; border-radius:8px" />
      <button>Send</button>
    </form>
  `;

  // Base styles (shared)
  Object.assign(bubble.style, {
    position: "fixed",
    padding: "12px 16px",
    borderRadius: "999px",
    border: "none",
    boxShadow: "0 6px 18px rgba(0,0,0,.2)",
    cursor: "pointer",
    zIndex: 999999,
  });
  Object.assign(panel.style, {
    position: "fixed",
    width: "320px",
    maxHeight: "420px",
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    boxShadow: "0 16px 40px rgba(0,0,0,.18)",
    display: "none",
    zIndex: 999999,
    padding: "12px",
    fontFamily: "system-ui, Segoe UI, Roboto, Arial, sans-serif",
  });

  // Helper: clear anchors, then apply desired ones
  function anchorReset(el) {
    Object.assign(el.style, {
      top: "auto",
      right: "auto",
      bottom: "auto",
      left: "auto",
      transform: "none",
    });
  }

  // Apply position to bubble + panel
  function applyPosition(position) {
    const bubbleOffset = 20;          // px from edges
    const gap = 10;                   // gap between bubble and panel
    const panelHeightPad = 70;        // approx bubble height + breathing room

    // Reset first
    anchorReset(bubble);
    anchorReset(panel);

    switch (position) {
      case "bottom-left": {
        Object.assign(bubble.style, { left: `${bubbleOffset}px`, bottom: `${bubbleOffset}px` });
        Object.assign(panel.style,  { left: `${bubbleOffset}px`, bottom: `${bubbleOffset + panelHeightPad}px` });
        break;
      }
      case "bottom-right": {
        Object.assign(bubble.style, { right: `${bubbleOffset}px`, bottom: `${bubbleOffset}px` });
        Object.assign(panel.style,  { right: `${bubbleOffset}px`, bottom: `${bubbleOffset + panelHeightPad}px` });
        break;
      }
      case "top-right": {
        Object.assign(bubble.style, { right: `${bubbleOffset}px`, top: `${bubbleOffset}px` });
        // panel goes just below the bubble
        Object.assign(panel.style,  { right: `${bubbleOffset}px`, top: `${bubbleOffset + panelHeightPad}px` });
        break;
      }
      case "top-left": {
        Object.assign(bubble.style, { left: `${bubbleOffset}px`, top: `${bubbleOffset}px` });
        Object.assign(panel.style,  { left: `${bubbleOffset}px`, top: `${bubbleOffset + panelHeightPad}px` });
        break;
      }
      case "bottom-center": {
        // center horizontally; bubble at bottom, panel above it
        Object.assign(bubble.style, {
          left: "50%",
          bottom: `${bubbleOffset}px`,
          transform: "translateX(-50%)",
        });
        Object.assign(panel.style, {
          left: "50%",
          bottom: `${bubbleOffset + panelHeightPad}px`,
          transform: "translateX(-50%)",
        });
        break;
      }
      default: {
        // fallback: bottom-right
        Object.assign(bubble.style, { right: `${bubbleOffset}px`, bottom: `${bubbleOffset}px` });
        Object.assign(panel.style,  { right: `${bubbleOffset}px`, bottom: `${bubbleOffset + panelHeightPad}px` });
        break;
      }
    }
  }

  document.body.appendChild(bubble);
  document.body.appendChild(panel);

  applyPosition(widgetPosition);



  const msgsEl = panel.querySelector("#msgs");
  const form = panel.querySelector("#f");
  const input = panel.querySelector("#t");

  bubble.addEventListener("click", () => {
    panel.style.display = panel.style.display === "none" ? "block" : "none";
  });

  function render(msg) {
    const div = document.createElement("div");
    div.style.margin = "6px 0";
    div.innerHTML =
      `<div style="font-size:12px; color:#777">${new Date(msg.ts).toLocaleTimeString()}</div>` +
      `<div><b>${msg.role === "user" ? "You" : "Bot"}:</b> ${escapeHtml(msg.text)}</div>`;
    msgsEl.appendChild(div);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }
  function escapeHtml(s) { return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  // Long-polling ---
  let lastId = null;
  async function startPollingLoop() {
    while (true) {
      try {
        const url = new URL(`${apiBase}/api/poll`);
        url.searchParams.set("companyId", companyId);
        url.searchParams.set("visitorId", visitorId);
        if (lastId) url.searchParams.set("lastId", lastId);
        const res = await fetch(url.toString());
        const data = await res.json();
        if (Array.isArray(data) && data.length) {
          data.forEach(m => { render(m); lastId = m.id; });
        }
      } catch (e) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  // WebSocket ---
  let ws;
  function connectWS() {
    const wsUrl = `${apiBase.replace(/^http/, "ws")}/ws?companyId=${encodeURIComponent(companyId)}&visitorId=${encodeURIComponent(visitorId)}`;
    ws = new WebSocket(wsUrl);
    ws.onopen = () => {};
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "history") {
          msg.payload.forEach(m => { render(m); lastId = m.id; });
        } else if (msg.type === "message") {
          render(msg.payload);
          lastId = msg.payload.id;
        }
      } catch {}
    };
    ws.onclose = () => setTimeout(connectWS, 800); // auto-reconnect
  }

  // Submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    if (transport === "ws" && ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "userMessage", text }));
    } else {
      await fetch(`${apiBase}/api/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, visitorId, text, transport: "poll" })
      });
    }
  });

  // Boot transport
  if (transport === "ws") connectWS();
  else startPollingLoop();
})();
