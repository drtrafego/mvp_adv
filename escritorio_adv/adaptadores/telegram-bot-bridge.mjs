/**
 * Ponte Oficial do Telegram para o Escritório Virtual Daniel Felix (@DanielFelixAdvBot)
 * 
 * Permite que o Dr. Daniel Felix e o Proprietário comandem a banca,
 * aprovem petições, confirmem prazos e autorizem cobranças diretamente do aplicativo
 * do Telegram (no celular ou computador), sincronizando em tempo real com o escritório.
 * 
 * Uso:
 *   TELEGRAM_BOT_TOKEN="seu_token_aqui" node adaptadores/telegram-bot-bridge.mjs
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, "..", "data", "office-state.json");
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const ALLOWED_USERS = (process.env.TELEGRAM_ALLOWED_USERS || "").split(",").map(s => s.trim()).filter(Boolean);
const API_BASE = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : "";

async function getOfficeState() {
  if (existsSync(STATE_FILE)) {
    try {
      const raw = await readFile(STATE_FILE, "utf8");
      return JSON.parse(raw);
    } catch {}
  }
  return null;
}

async function saveOfficeState(state) {
  try {
    await writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch (err) {
    console.error("[Telegram Bridge] Erro ao persistir estado:", err.message);
  }
}

async function tgRequest(method, payload = {}) {
  if (!API_BASE) return null;
  const res = await fetch(`${API_BASE}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error(`[Telegram Bridge] Erro na API do Telegram [${method}]: ${errText}`);
    return null;
  }
  return res.json();
}

export async function processTelegramCommand(text, fromUser = "Dr. Daniel Felix") {
  const state = await getOfficeState();
  const q = (text || "").toLocaleLowerCase("pt-BR");
  let reply = "";
  let buttons = [];

  const petitions = state?.petitions || [];
  const deadlines = state?.deadlinesList || [];
  const clients = state?.clients || [];
  const finItems = state?.financeiro?.items || [];
  const outbox = state?.financeiro?.outbox || [];

  if (q.includes("/start") || q.includes("/menu")) {
    reply = `🏛️ *Escritório Virtual Daniel Felix Advocacia*\n\n` +
      `Olá, Dr. Daniel! Sou a *Luana*, Coordenadora Operacional da banca.\n` +
      `Todos os 17 agentes e especialistas estão a postos. Como deseja prosseguir?`;
    buttons = [
      [{ text: "⚖️ Petições para Revisão", callback_data: "cmd_peticoes" }, { text: "📅 Prazos da Clara", callback_data: "cmd_prazos" }],
      [{ text: "👥 Clientes & Dossiês", callback_data: "cmd_clientes" }, { text: "💰 Caixa & Financeiro", callback_data: "cmd_financeiro" }],
      [{ text: "✍️ Procurações ZapSign", callback_data: "cmd_procuracao" }, { text: "📊 Resumo Geral", callback_data: "cmd_resumo" }]
    ];
  } else if (q.includes("/peticoes") || q.includes("petiç") || q.includes("minuta")) {
    const review = petitions.filter(p => p.status === "review");
    reply = `⚖️ *Central de Petições & Minutas Jurídicas*\n\n` +
      `Temos *${petitions.length} peças* na banca (*${review.length} aguardando sua revisão humana*):\n\n` +
      petitions.map(p => `• *[${p.code}]* ${p.title.slice(0, 45)}...\n  Cliente: ${p.clientName} (${p.statusLabel})`).join("\n\n");
    
    buttons = review.slice(0, 3).map(p => [
      { text: `✅ Aprovar ${p.code} (${p.clientName.split(" ")[0]})`, callback_data: `approve_pet_${p.id}` }
    ]);
    buttons.push([{ text: "🔙 Menu Principal", callback_data: "cmd_menu" }]);
  } else if (q.includes("/prazos") || q.includes("prazo") || q.includes("clara")) {
    const pend = deadlines.filter(d => d.status === "Sugestão");
    reply = `📅 *Controladoria de Prazos (Clara)*\n\n` +
      `A Clara calculou *${pend.length} sugestões determinísticas de prazo* para sua confirmação:\n\n` +
      deadlines.map(d => `• *${d.ato}* (${d.clientName})\n  Data Fatal: *${d.dataFatal}* (${d.rito}) · ${d.status}`).join("\n\n");
    
    buttons = pend.map(d => [
      { text: `✓ Confirmar Prazo ${d.clientName.split(" ")[0]} (${d.dataFatal})`, callback_data: `confirm_dead_${d.id}` }
    ]);
    buttons.push([{ text: "🔙 Menu Principal", callback_data: "cmd_menu" }]);
  } else if (q.includes("/financeiro") || q.includes("caixa") || q.includes("honor")) {
    const paid = finItems.filter(x => x.status === "paid").reduce((s, x) => s + Number(x.amount || 0), 0);
    const open = finItems.filter(x => x.status === "open").reduce((s, x) => s + Number(x.amount || 0), 0);
    const pendOut = outbox.filter(o => o.status === "pending");
    reply = `💰 *Gestão Financeira & Honorários (Rui)*\n\n` +
      `• *Caixa Recebido:* R$ ${paid.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n` +
      `• *A Receber:* R$ ${open.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n` +
      `• *Fila de Cobrança Outbox:* ${pendOut.length} mensagens prontas para envio`;
    
    if (pendOut.length > 0) {
      buttons = pendOut.map(o => [
        { text: `📲 Autorizar Envio (${o.clientName} · R$ ${o.amount})`, callback_data: `send_out_${o.id}` }
      ]);
    }
    buttons.push([{ text: "🔙 Menu Principal", callback_data: "cmd_menu" }]);
  } else if (q.includes("/clientes") || q.includes("cliente")) {
    reply = `👥 *Pastas de Clientes & Dossiês 360°*\n\n` +
      `A banca possui *${clients.length} clientes ativos* com qualificação e provas conferidas:\n\n` +
      clients.map(c => `• *${c.name}* (${c.area})\n  Caso: ${c.caseTitle} · Fase: ${c.stage}`).join("\n\n");
    buttons = [[{ text: "🔙 Menu Principal", callback_data: "cmd_menu" }]];
  } else {
    reply = `Dr. Daniel, Luana recebeu seu comando: "${text}".\n` +
      `Distribuindo para o especialista correspondente na banca. Você pode usar /menu para ver os atalhos.`;
    buttons = [[{ text: "🔙 Menu Principal", callback_data: "cmd_menu" }]];
  }

  // Registra no histórico do escritório
  if (state) {
    if (!state.telegramMessages) state.telegramMessages = [];
    state.telegramMessages.push({
      id: `tg-ext-${Date.now()}`,
      sender: "daniel",
      senderName: fromUser,
      time: new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date()),
      text
    });
    state.telegramMessages.push({
      id: `tg-rep-${Date.now() + 1}`,
      sender: "coordenador",
      senderName: "Luana · Coordenadora (@DanielFelixAdvBot)",
      time: new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date()),
      text: reply.replace(/\*/g, "")
    });
    await saveOfficeState(state);
  }

  return { reply, buttons };
}

export async function processTelegramCallback(callbackData, fromUser = "Dr. Daniel Felix") {
  const state = await getOfficeState();
  let alertText = "";

  if (callbackData.startsWith("approve_pet_")) {
    const petId = callbackData.replace("approve_pet_", "");
    const pet = state?.petitions?.find(p => p.id === petId);
    if (pet) {
      pet.status = "approved";
      pet.statusLabel = "Aprovada por Dr. Daniel Felix · Pronta p/ Protocolo";
      pet.approvedBy = "Dr. Daniel Felix (via Telegram)";
      pet.approvedAt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date());
      alertText = `✅ Peça ${pet.code} (${pet.clientName}) aprovada com sucesso!`;
      await saveOfficeState(state);
    }
  } else if (callbackData.startsWith("confirm_dead_")) {
    const deadId = callbackData.replace("confirm_dead_", "");
    const d = state?.deadlinesList?.find(x => x.id === deadId);
    if (d) {
      d.status = "Confirmado por Dr. Daniel Felix";
      d.confirmedBy = "Dr. Daniel Felix (via Telegram)";
      alertText = `✓ Prazo "${d.ato}" confirmado para ${d.dataFatal}!`;
      await saveOfficeState(state);
    }
  } else if (callbackData.startsWith("send_out_")) {
    const outId = callbackData.replace("send_out_", "");
    const o = state?.financeiro?.outbox?.find(x => x.id === outId);
    if (o) {
      o.status = "sent";
      alertText = `📲 Cobrança enviada com sucesso para ${o.clientName}!`;
      await saveOfficeState(state);
    }
  } else if (callbackData === "cmd_menu") {
    return processTelegramCommand("/start", fromUser);
  } else if (callbackData.startsWith("cmd_")) {
    return processTelegramCommand("/" + callbackData.replace("cmd_", ""), fromUser);
  }

  return { alertText, refresh: true };
}

async function startBridge() {
  console.log("\n=======================================================");
  console.log("✈️ PONTE TELEGRAM · ESCRITÓRIO VIRTUAL DANIEL FELIX");
  console.log("=======================================================");

  if (!BOT_TOKEN) {
    console.log("⚠️ AVISO: TELEGRAM_BOT_TOKEN não configurado no ambiente.");
    console.log("Para conectar ao bot real do Telegram, execute:");
    console.log("  $env:TELEGRAM_BOT_TOKEN=\"seu_token\"; node adaptadores/telegram-bot-bridge.mjs");
    console.log("O escritório continuará funcionando 100% via web e dock em http://localhost:3000.\n");
    return;
  }

  const me = await tgRequest("getMe");
  if (!me?.ok) {
    console.error("❌ Falha ao conectar ao Telegram. Verifique seu TELEGRAM_BOT_TOKEN.");
    return;
  }

  console.log(`✅ Conectado com sucesso ao bot: @${me.result.username} (${me.result.first_name})`);
  console.log(`Aguardando mensagens de Dr. Daniel Felix no Telegram...\n`);

  let offset = 0;
  while (true) {
    try {
      const updates = await tgRequest("getUpdates", { offset, timeout: 25 });
      if (updates?.ok && Array.isArray(updates.result)) {
        for (const u of updates.result) {
          offset = u.update_id + 1;

          if (u.message) {
            const chatId = u.message.chat.id;
            const fromName = `${u.message.from?.first_name || ""} ${u.message.from?.last_name || ""}`.trim() || "Dr. Daniel Felix";
            const text = u.message.text || (u.message.voice ? "[Áudio / Nota de Voz recebida]" : "");

            if (ALLOWED_USERS.length > 0 && !ALLOWED_USERS.includes(String(chatId))) {
              await tgRequest("sendMessage", {
                chat_id: chatId,
                text: "⚠️ Acesso restrito aos advogados credenciados do Escritório Daniel Felix."
              });
              continue;
            }

            const { reply, buttons } = await processTelegramCommand(text, fromName);
            await tgRequest("sendMessage", {
              chat_id: chatId,
              text: reply,
              parse_mode: "Markdown",
              reply_markup: buttons.length ? { inline_keyboard: buttons } : undefined
            });
          } else if (u.callback_query) {
            const chatId = u.callback_query.message.chat.id;
            const msgId = u.callback_query.message.message_id;
            const data = u.callback_query.data;
            const fromName = `${u.callback_query.from?.first_name || ""} ${u.callback_query.from?.last_name || ""}`.trim() || "Dr. Daniel Felix";

            const res = await processTelegramCallback(data, fromName);
            if (res.alertText) {
              await tgRequest("answerCallbackQuery", { callback_query_id: u.callback_query.id, text: res.alertText });
              await tgRequest("sendMessage", { chat_id: chatId, text: res.alertText });
            } else if (res.reply) {
              await tgRequest("answerCallbackQuery", { callback_query_id: u.callback_query.id });
              await tgRequest("editMessageText", {
                chat_id: chatId,
                message_id: msgId,
                text: res.reply,
                parse_mode: "Markdown",
                reply_markup: res.buttons?.length ? { inline_keyboard: res.buttons } : undefined
              });
            }
          }
        }
      }
    } catch (err) {
      console.error("[Telegram Bridge] Erro no loop de polling:", err.message);
      await new Promise(r => setTimeout(r, 4000));
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startBridge();
}
