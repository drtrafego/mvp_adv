import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initialState } from "./prototipo/src/model.mjs";
import { processTelegramCommand, processTelegramCallback } from "./adaptadores/telegram-bot-bridge.mjs";
import { buildHabblaudSnapshot, buildHabblaudFeed } from "./adaptadores/habblaud-adapter.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const GABINETE_API_URL = process.env.GABINETE_API_URL || "";
const DATA_DIR = path.join(__dirname, "data");
const STATE_FILE = path.join(DATA_DIR, "office-state.json");
const HABBLAUD_DIR = path.join(__dirname, "habblaud");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
};

// Gerenciamento de Clientes SSE para sincronização em tempo real
const sseClients = new Set();

function broadcastSse(eventType, data) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Inicializa armazenamento em disco se necessário
async function loadOrInitState() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
  if (existsSync(STATE_FILE)) {
    try {
      const raw = await readFile(STATE_FILE, "utf8");
      return JSON.parse(raw);
    } catch (e) {
      console.warn("[Server] Aviso: estado local corrompido, reinicializando...", e.message);
    }
  }
  const fresh = initialState();
  await writeFile(STATE_FILE, JSON.stringify(fresh, null, 2), "utf8");
  return fresh;
}

async function saveState(state) {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
  broadcastSse("state_update", { updatedAt: new Date().toISOString() });
  
  // Transmite atualização no formato do motor isométrico Habblaud
  const habblaudSnap = buildHabblaudSnapshot(state);
  const habblaudFeed = buildHabblaudFeed(state);
  broadcastSse("snapshot", habblaudSnap);
  broadcastSse("feed", habblaudFeed);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // 1. Server-Sent Events (SSE) para Habblaud (/api/stream) e legado (/api/office/stream)
  if (pathname === "/api/stream" || pathname === "/api/office/stream" || pathname === "/api/office/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    res.write("retry: 3000\n\n");
    
    // Conexão inicial com snapshot e feed para o Habblaud
    const state = await loadOrInitState();
    const habblaudSnap = buildHabblaudSnapshot(state);
    const habblaudFeed = buildHabblaudFeed(state);
    res.write(`event: snapshot\ndata: ${JSON.stringify(habblaudSnap)}\n\n`);
    res.write(`event: feed\ndata: ${JSON.stringify(habblaudFeed)}\n\n`);
    res.write(`event: connected\ndata: ${JSON.stringify({ status: "connected", time: new Date().toISOString() })}\n\n`);
    
    sseClients.add(res);
    req.on("close", () => {
      sseClients.delete(res);
    });
    return;
  }

  // 2. Permissões de Acesso do Habblaud
  if (pathname === "/api/access") {
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    return res.end(JSON.stringify({
      remote: false,
      local: true,
      permissions: true,
      messages: true,
      terminal: false,
      spawn: false,
      world: false,
    }));
  }

  // 3. Detalhes de Agente para a Gaveta do Habblaud
  if (pathname.startsWith("/api/agents/")) {
    const agentId = decodeURIComponent(pathname.replace("/api/agents/", ""));
    const state = await loadOrInitState();
    const snap = buildHabblaudSnapshot(state);
    const agent = snap.agents.find(a => a.id === agentId) || snap.agents[0];
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({
      agent,
      recent: agent.recent || [],
      shells: []
    }));
  }

  // 4. Leitura e Gravação do Estado Persistente do Escritório
  if (pathname === "/api/office/state") {
    if (req.method === "GET") {
      const state = await loadOrInitState();
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      return res.end(JSON.stringify(state));
    }

    if (req.method === "POST") {
      let body = "";
      req.on("data", chunk => (body += chunk));
      req.on("end", async () => {
        try {
          const parsed = JSON.parse(body);
          await saveState(parsed);
          res.writeHead(200, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ ok: true, savedAt: new Date().toISOString() }));
        } catch (err) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "Payload inválido", details: err.message }));
        }
      });
      return;
    }
  }

  // 5. Execução de Comandos do Telegram / Ações Rápidas
  if (pathname === "/api/office/command" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => (body += chunk));
    req.on("end", async () => {
      try {
        const { cmd, user } = JSON.parse(body);
        const result = await processTelegramCommand(cmd, user || "Dr. Daniel Felix");
        broadcastSse("telegram_message", { cmd, result });
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 6. Ações Pontuais do Advogado (Aprovar Petição, Confirmar Prazo, Dar Baixa, Outbox)
  if (pathname === "/api/office/action" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => (body += chunk));
    req.on("end", async () => {
      try {
        const { action, payload, user } = JSON.parse(body);
        const state = await loadOrInitState();

        if (action === "approve_petition") {
          const pet = state.petitions?.find(p => p.id === payload.id);
          if (pet) {
            pet.status = "approved";
            pet.statusLabel = "Aprovada por Dr. Daniel Felix · Pronta p/ Protocolo";
            pet.approvedBy = user || "Dr. Daniel Felix";
            pet.approvedAt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date());
          }
        } else if (action === "confirm_deadline") {
          const d = state.deadlinesList?.find(x => x.id === payload.id);
          if (d) {
            d.status = "Confirmado por Dr. Daniel Felix";
            d.confirmedBy = user || "Dr. Daniel Felix";
          }
        } else if (action === "pay_financeiro") {
          const item = state.financeiro?.items?.find(x => x.id === payload.id);
          if (item) {
            item.status = "paid";
            item.paidAt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
            const cli = state.clients?.find(c => c.id === item.clientId);
            if (cli) cli.honorariosPaid = (cli.honorariosPaid || 0) + Number(item.amount || 0);
          }
        } else if (action === "send_outbox") {
          const o = state.financeiro?.outbox?.find(x => x.id === payload.id);
          if (o) o.status = "sent";
        }

        await saveState(state);
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: true, action }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 7. Compatibilidade com Gabinete do MVP
  if (pathname === "/api/escritorio/estado") {
    if (GABINETE_API_URL) {
      try {
        const remoteRes = await fetch(`${GABINETE_API_URL}/api/escritorio/estado`, {
          headers: { Cookie: req.headers.cookie || "" },
        });
        const data = await remoteRes.json();
        res.writeHead(remoteRes.status, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(data));
      } catch (err) {
        res.writeHead(503, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Gabinete remoto indisponível", details: err.message }));
      }
    }

    const state = await loadOrInitState();
    const estadoLocal = {
      schemaVersion: 1,
      mode: "live",
      generatedAt: new Date().toISOString(),
      office: "Daniel Felix",
      summary: {
        totalProcessos: state.processesList?.length || 128,
        venceEm7Dias: (state.deadlinesList || []).length,
        sugeridos: (state.deadlinesList || []).filter(d => d.status === "Sugestão").length,
        intimacoesSemAnalise: (state.noticesList || []).length,
        clientesSugeridos: (state.clients || []).length,
      },
      metrics: {
        label: "Escritório Daniel Felix",
        processes: state.processesList?.length || 128,
        deadlines: (state.deadlinesList || []).length,
        leads: (state.clients || []).length * 4,
        contracts: (state.contractsList || []).length,
        petitions: (state.petitions || []).length,
        received: (state.financeiro?.items || []).filter(x => x.status === "paid").reduce((s, x) => s + Number(x.amount || 0), 0),
        receivable: (state.financeiro?.items || []).filter(x => x.status !== "paid").reduce((s, x) => s + Number(x.amount || 0), 0),
        series: [12, 19, 15, 23, 28, 24, 30],
        funnel: [32, 18, 11, 7],
      },
      processes: state.processesList || [],
      deadlines: state.deadlinesList || [],
      notices: state.noticesList || [],
      health: [
        { fonte: "DataJud", status: "ok", quando: "Hoje às 06:00", novos: 5 },
        { fonte: "DJEN", status: "ok", quando: "Hoje às 07:15", novos: 3 },
      ],
      execution: {
        connected: true,
        worker: "daniel-worker-1",
        queue: "office_jobs",
      },
    };

    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    return res.end(JSON.stringify(estadoLocal));
  }

  // 8. Roteamento de Arquivos do Motor Habblaud e Aplicação
  let filePath;

  // Rota direta para o motor Habblaud (/habblaud)
  if (pathname === "/habblaud" || pathname === "/habblaud/") {
    filePath = path.join(HABBLAUD_DIR, "index.html");
  } else if (
    pathname.startsWith("/bundle/") ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/brand/") ||
    pathname.startsWith("/art/") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/manifest.json" ||
    pathname === "/og-image.png"
  ) {
    filePath = path.join(HABBLAUD_DIR, pathname.replace(/^\//, ""));
  } else if (pathname === "/") {
    filePath = path.join(__dirname, "index.html");
  } else {
    filePath = path.join(__dirname, pathname);
    if (!existsSync(filePath) && existsSync(path.join(__dirname, "prototipo", pathname))) {
      filePath = path.join(__dirname, "prototipo", pathname);
    } else if (!existsSync(filePath) && existsSync(path.join(HABBLAUD_DIR, pathname))) {
      filePath = path.join(HABBLAUD_DIR, pathname);
    }
  }

  if (existsSync(filePath)) {
    try {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || "application/octet-stream";
      const content = await readFile(filePath);
      res.writeHead(200, { "Content-Type": contentType });
      return res.end(content);
    } catch {
      res.writeHead(500, { "Content-Type": "text/plain" });
      return res.end("Erro interno ao ler arquivo.");
    }
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("404 Não Encontrado");
});

server.listen(PORT, async () => {
  await loadOrInitState();
  console.log(`\n========================================================`);
  console.log(`🏢 ESCRITÓRIO VIRTUAL DANIEL FELIX (Motor Habblaud + SSE)`);
  console.log(`📍 Servidor rodando em: http://localhost:${PORT}`);
  console.log(`🎮 Motor Isométrico Habblaud: http://localhost:${PORT}/habblaud`);
  console.log(`========================================================\n`);
});
