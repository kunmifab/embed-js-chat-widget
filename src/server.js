const express = require('express');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const { randomUUID } = require("crypto");
const { use } = require('passport');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const publicDir = path.resolve(__dirname, "../public");
app.use(express.static(publicDir));

const conversations = {};
const pendingLongPolls = {};

/** Utility: get or create conversation */
function getConversation(companyId, visitorId) {
  let convId = `${companyId}:${visitorId}`;
  if (!conversations[convId]) {
    conversations[convId] = { companyId, visitors: new Set([visitorId]), messages: [] };
  }
  return { convId, conv: conversations[convId] };
}

/** Simulate AI processing */
function simulateAIReply(text) {
  // fake latency + canned reply
  const variants = [
    `You said: "${text}". Got it!`,
    `Echo: ${text}`,
    `Processing complete: ${text}`,
  ];
  return variants[Math.floor(Math.random() * variants.length)];
}

/** Push a message and notify any long-poll waiters + WebSocket clients */
function deliverMessage(convId, msg) {
  const conv = conversations[convId];
  conv.messages.push(msg);

  // Long-poll delivery
  const waiters = pendingLongPolls[convId] || [];
  pendingLongPolls[convId] = [];
  waiters.forEach(({ resolve, timer }) => {
    clearTimeout(timer);
    resolve([msg]);
  });

  // WebSocket delivery
  const sockets = wsRooms.get(convId) || new Set();
  sockets.forEach(ws => {
    try { ws.send(JSON.stringify({ type: "message", payload: msg })); } catch {}
  });
}

/** Send user message */
app.post("/api/messages", (req, res) => {
  const { companyId, visitorId, text, transport = "poll" } = req.body || {};
  if (!companyId || !visitorId || !text) {
    return res.status(400).json({ error: "companyId, visitorId, text are required" });
  }
  const { convId } = getConversation(companyId, visitorId);

  // Store user message
  const userMsg = { id: randomUUID(), role: "user", text, ts: Date.now() };
  deliverMessage(convId, userMsg);

  // Simulate async AI response
  setTimeout(() => {
    const aiMsg = { id: randomUUID(), role: "assistant", text: simulateAIReply(text), ts: Date.now() };
    deliverMessage(convId, aiMsg);
  }, 800 + Math.random() * 800);

  res.json({ ok: true, convId, transport });
});

/** Long-poll endpoint: returns new messages since lastId (or waits up to 25s) */
app.get("/api/poll", (req, res) => {
  const { companyId, visitorId, lastId } = req.query;
  if (!companyId || !visitorId) return res.status(400).json({ error: "companyId, visitorId required" });

  const { convId, conv } = getConversation(companyId, visitorId);

  // find messages after lastId
  let startIdx = 0;
  if (lastId) {
    const idx = conv.messages.findIndex(m => m.id === lastId);
    startIdx = idx >= 0 ? idx + 1 : conv.messages.length;
  }
  const fresh = conv.messages.slice(startIdx);
  if (fresh.length) {
    return res.json(fresh);
  }

  // no messages yet → long-poll wait up to 25s
  if (!pendingLongPolls[convId]) pendingLongPolls[convId] = [];
  let resolved = false;
  const timer = setTimeout(() => {
    if (!resolved) {
      resolved = true;
      res.json([]); // timeout with empty array
    }
  }, 25000);
  pendingLongPolls[convId].push({
    resolve: (msgs) => {
      if (!resolved) {
        resolved = true;
        res.json(msgs);
      }
    },
    timer
  });
});

/** Serve the demo host page */
app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "host.html"));
});

const server = app.listen(3000, () => {
  console.log("Server on http://localhost:3000");
});


/** --- WebSocket setup --- */
const wss = new WebSocketServer({ server, path: "/ws" });
const wsRooms = new Map(); // convId -> Set<WebSocket>

wss.on("connection", (ws, req) => {
  // Expect query: ?companyId=...&visitorId=...
  const url = new URL(req.url, "http://localhost");
  const companyId = url.searchParams.get("companyId");
  const visitorId = url.searchParams.get("visitorId");
  if (!companyId || !visitorId) {
    ws.close(1008, "Missing params");
    return;
  }
  const { convId, conv } = getConversation(companyId, visitorId);
  if (!wsRooms.get(convId)) wsRooms.set(convId, new Set());
  wsRooms.get(convId).add(ws);

  // On connect: send recent history (last 20)
  const recent = conv.messages.slice(-20);
  ws.send(JSON.stringify({ type: "history", payload: recent }));

  ws.on("message", (buf) => {
    try {
      const msg = JSON.parse(buf.toString());
      if (msg.type === "userMessage" && msg.text) {
        const userMsg = { id: randomUUID(), role: "user", text: msg.text, ts: Date.now() };
        deliverMessage(convId, userMsg);
        setTimeout(() => {
          const aiMsg = { id: randomUUID(), role: "assistant", text: simulateAIReply(msg.text), ts: Date.now() };
          deliverMessage(convId, aiMsg);
        }, 800 + Math.random() * 800);
      }
    } catch {}
  });

  ws.on("close", () => {
    const set = wsRooms.get(convId);
    if (set) {
      set.delete(ws);
      if (!set.size) wsRooms.delete(convId);
    }
  });
});