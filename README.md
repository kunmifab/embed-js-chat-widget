# Embed Chat Widget Demo

A self-contained demo that shows how a drop-in chat widget (embed.js) can talk to a Node.js backend using either long polling or WebSockets. It is meant as a playground for understanding how embeddable scripts coordinate state, transport, and UI without relying on a full product stack.

## Features

* Floating chat bubble + panel UI that can be embedded on any page with a single <script> tag
* Visitor identity persisted in localStorage, conversation history kept in memory on the server
* Transport toggle between long polling and WebSockets to compare latency and architecture trade-offs
* Express server that serves static assets, handles incoming messages, and simulates AI replies
* Minimal, dependency-light stack that�s easy to explore or extend

## Prerequisites

* Node.js 18 or newer (for crypto.randomUUID and modern ECMAScript features)
* npm 9+ (bundled with recent Node.js versions)

## Getting Started

```bash
# Clone your fork of the repo
git clone https://github.com/kunmifab/embed-js-chat-widget.git
cd embed-demo

# Install dependencies
npm install

# Start the demo server (listens on http://localhost:3000)
node src/server.js
```

Once the server is running, open [http://localhost:3000](http://localhost:3000) in a browser. The public/host.html page loads the widget via the script tag that would normally live on a customer site.

## Using the Widget on Another Site

Add the following script tag to any HTML page (adjust attributes as needed):

```html
<script
  src="http://localhost:3000/embed.js"
  data-company="demo-company"
  data-transport="ws"     <!-- "ws" for WebSockets, "poll" for long polling -->
  data-position="bottom-right"
  data-api="http://localhost:3000">
</script>
```

### Data Attributes

* data-company: Logical tenant/customer identifier (used in conversation keys)
* data-transport: ws or poll to select how messages flow from the backend
* data-position: Controls bubble/panel anchoring (ottom-right, ottom-left, ottom-center, 	op-right, 	op-left)
* data-api: Base URL for the API and WebSocket endpoints; point this to your deployed backend if hosting remotely

## API & Transport Details

### HTTP Endpoints

* POST /api/messages

  * Body: { companyId, visitorId, text, transport }
  * Stores the visitor message, kicks off a simulated AI reply, and returns { ok: true, convId, transport }
* GET /api/poll

  * Query: companyId, visitorId, optional lastId
  * Returns any new messages immediately or holds the request open for up to 25 seconds (long polling)
* GET /

  * Serves public/host.html, a simple demo host page

### WebSocket Endpoint

* ws\://<host>/ws?companyId=...\&visitorId=...

  * On connect: sends recent message history (	type: "history")
  * New messages broadcast as 	type: "message"
  * Client can send { type: "userMessage", text } to push a new visitor message

## Project Structure

```
.
+- public/
|  +- embed.js       # Embeddable widget script
|  +- host.html      # Demo host page served at /
+- src/
|  +- server.js      # Express + WebSocket backend
+- package.json
+- README.md
```

## Development Notes

* Conversation history and pending long-poll requests live in memory; restart the server to reset state
* The simulated AI reply uses a canned set of responses with randomized delay to mimic real processing
* Feel free to add a start script (e.g. "start": "node src/server.js") if you prefer
  pm start
* For production-style deployments, you�d typically add persistence, authentication, rate limiting, metrics, and swap long polling for WebSockets where infrastructure allows it

## Extending the Demo

Ideas for experimentation:

1. Persist conversations to a database (SQLite, Postgres, etc.)
2. Replace the canned AI reply with a real assistant or third-party API
3. Add typing indicators or read receipts to contrast polling vs WebSocket UX
4. Introduce reconnect/backoff strategies and health pings for the WebSocket client

## License
MIT
