import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const snap = readFileSync('habblaud/initial-snapshot.json', 'utf8').trim();
const feed = readFileSync('habblaud/initial-feed.json', 'utf8').trim();

const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="color-scheme" content="dark" />
    <meta name="theme-color" content="#12151d" />
    <meta name="description" content="Daniel Felix Advocacia — Escritório Virtual em Pixel Art Isométrico 3D (Motor Habblaud). Petições, Prazos CPC, Clientes, ZapSign e Financeiro." />
    <title>Daniel Felix Advocacia · Motor Isométrico 3D (Habblaud)</title>
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Daniel Felix Advocacia" />
    <meta property="og:title" content="Daniel Felix Advocacia · Motor Isométrico 3D" />
    <meta property="og:description" content="Escritório Virtual em Pixel Art Isométrico 3D movido a Habblaud. 14 agentes, 4 salas de operação e decisões privativas de advogado." />
    <meta property="og:locale" content="pt_BR" />
    <meta property="og:image" content="./assets/og-image.png" />
    <link rel="icon" href="./assets/brand/favicon-32.png" type="image/png" sizes="32x32" />
    <link rel="icon" href="./assets/brand/favicon-16.png" type="image/png" sizes="16x16" />
    <link rel="apple-touch-icon" href="./assets/brand/apple-touch-icon.png" />
    <link rel="manifest" href="./manifest.webmanifest" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Daniel Felix ADV" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black" />
    <style>
      html,body{background:#12151d;height:100%;margin:0;overflow:hidden;font-family:Inter,system-ui,-apple-system,sans-serif}
      #world,#city,#visit{width:100vw;height:100vh;image-rendering:pixelated;display:block;position:fixed;inset:0}
      #world[hidden],#city[hidden],#visit[hidden]{display:none}
      #ui{pointer-events:none;position:fixed;inset:0}
      #ui>*{pointer-events:auto}

      /* Barra Superior Flutuante Daniel Felix Advocacia */
      #df-topbar {
        position: fixed;
        top: 10px;
        left: 12px;
        right: 12px;
        z-index: 8000;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 8px 16px;
        background: #101c24f2;
        backdrop-filter: blur(12px);
        border: 1px solid #2e4450;
        border-radius: 10px;
        color: #f1efe8;
        font-size: 13px;
        box-shadow: 0 10px 32px #000a;
        pointer-events: auto;
      }
      .df-brand { display: flex; align-items: center; gap: 12px; }
      .df-monogram {
        width: 36px; height: 34px; border: 1px solid #947c50; border-radius: 6px;
        background: #172631; display: grid; place-items: center; font: 700 13px Georgia, serif;
        color: #dfc082; letter-spacing: 1px;
      }
      .df-title { font-family: Georgia, serif; font-size: 15px; color: #f5f3ec; font-weight: 600; }
      .df-badge {
        font-size: 11px; font-weight: 700; color: #7ce3ba; background: #1d3e33;
        border: 1px solid #3c7d63; border-radius: 5px; padding: 3px 8px; letter-spacing: .5px;
        margin-left: 8px; display: inline-flex; align-items: center; gap: 5px;
      }
      .df-badge i { width: 6px; height: 6px; border-radius: 50%; background: #56dfa7; box-shadow: 0 0 6px #56dfa7; display: inline-block; }
      .df-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .df-btn {
        background: #1a2a35; border: 1px solid #3a4f5c; border-radius: 6px; color: #e2ecee;
        padding: 7px 12px; font-size: 12.5px; font-weight: 600; cursor: pointer;
        display: inline-flex; align-items: center; gap: 6px; transition: .15s; text-decoration: none;
      }
      .df-btn:hover { background: #253b4a; border-color: #557284; color: #fff; }
      .df-btn-gold { background: #3a3220; border-color: #8c7241; color: #f7e0b5; }
      .df-btn-gold:hover { background: #4a402a; border-color: #bfa05d; color: #fff; }
      .df-btn-green { background: #1b382d; border-color: #3b755d; color: #b5f5d8; }
      .df-btn-green:hover { background: #244b3c; border-color: #519d7d; }

      /* Modais Jurídicos */
      dialog#legal-modal {
        border: 1px solid #4a5c66; border-radius: 12px; color: #f1efe8; background: #13222c;
        padding: 0; width: min(1180px, calc(100vw - 32px)); max-height: 90vh;
        box-shadow: 0 30px 100px #000d; z-index: 9999;
      }
      dialog#legal-modal::backdrop { background: #060e15b3; backdrop-filter: blur(6px); }
      .lm-head {
        display: flex; align-items: center; justify-content: space-between; padding: 18px 24px;
        border-bottom: 1px solid #2b3d49; background: #162632; position: sticky; top: 0; z-index: 2;
      }
      .lm-head h2 { margin: 0; font: 22px Georgia, serif; color: #f5f2eb; }
      .lm-close {
        background: #ffffff0d; border: 1px solid #455762; border-radius: 6px; color: #dbe4e7;
        font-size: 20px; width: 34px; height: 34px; cursor: pointer; display: grid; place-items: center;
      }
      .lm-close:hover { background: #ffffff1f; }
      .lm-body { padding: 24px; overflow-y: auto; max-height: calc(90vh - 75px); }
      .lm-grid-split { display: grid; grid-template-columns: 320px 1fr; gap: 20px; }
      @media(max-width: 820px) {
        .lm-grid-split { grid-template-columns: 1fr; }
        #df-topbar { flex-direction: column; align-items: stretch; }
        .df-actions { overflow-x: auto; padding-bottom: 4px; }
      }
      .lm-card { background: #172834; border: 1px solid #2f4350; border-radius: 8px; padding: 16px; }
      .lm-paper {
        background: #0d171e; border: 1px solid #3d515e; border-radius: 8px; padding: 20px;
        font-family: Georgia, serif; font-size: 14.5px; line-height: 1.8; color: #f1eee8; white-space: pre-wrap;
      }
      .lm-badge {
        display: inline-flex; align-items: center; gap: 5px; padding: 3px 8px; border-radius: 4px;
        font-size: 11px; font-weight: 700; border: 1px solid #4a5c66; background: #1d2f3a; color: #d1dee3;
      }
      .lm-badge-gold { color: #f2d596; border-color: #8c7343; background: #372c1a; }
      .lm-badge-green { color: #9df0cb; border-color: #3b7b60; background: #19392c; }
      .lm-badge-blue { color: #a4dcfa; border-color: #3f7493; background: #1c3343; }
      .lm-btn-action {
        background: #dbb97c; color: #172026; border: 1px solid #efd194; font-weight: 700;
        padding: 9px 15px; border-radius: 6px; font-size: 13px; cursor: pointer; transition: .15s;
        display: inline-flex; align-items: center; gap: 6px;
      }
      .lm-btn-action:hover { background: #e7ca92; }
      .lm-btn-sec {
        background: #233541; border: 1px solid #415664; color: #dce5e9; font-weight: 600;
        padding: 8px 14px; border-radius: 6px; font-size: 12.5px; cursor: pointer;
        display: inline-flex; align-items: center; gap: 6px;
      }
      .lm-btn-sec:hover { background: #2f4554; border-color: #617b8d; }
    </style>
    <script>
      window.__LEGAL_SNAPSHOT__ = ${snap};
      window.__LEGAL_FEED__ = ${feed};
    </script>
    <script type="module" crossorigin src="./bundle/main-MyDK9MRT.js"></script>
  </head>
  <body>
    <!-- Topbar Flutuante do Escritório Daniel Felix Advocacia -->
    <header id="df-topbar" style="position:fixed;top:10px;left:12px;right:12px;z-index:8000;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 16px;background:#101c24f2;backdrop-filter:blur(12px);border:1px solid #2e4450;border-radius:10px;color:#f1efe8;font-size:13px;box-shadow:0 10px 32px #000a;pointer-events:auto;">
      <div class="df-brand" style="display:flex;align-items:center;gap:12px">
        <div class="df-monogram" style="width:36px;height:34px;border:1px solid #947c50;border-radius:6px;background:#172631;display:grid;place-items:center;font:700 13px Georgia,serif;color:#dfc082;letter-spacing:1px">DF</div>
        <div>
          <strong class="df-title" style="font-family:Georgia,serif;font-size:15px;color:#f5f3ec;font-weight:600">Daniel Felix Advocacia</strong>
          <span class="df-badge" style="font-size:11px;font-weight:700;color:#7ce3ba;background:#1d3e33;border:1px solid #3c7d63;border-radius:5px;padding:3px 8px;letter-spacing:.5px;margin-left:8px;display:inline-flex;align-items:center;gap:5px"><i style="width:6px;height:6px;border-radius:50%;background:#56dfa7;box-shadow:0 0 6px #56dfa7;display:inline-block"></i>MOTOR ISOMÉTRICO 3D (HABBLAUD)</span>
        </div>
      </div>
      <div class="df-actions" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <button class="df-btn df-btn-green" onclick="window.openLegalModal('telegram')">🎙️ Telegram</button>
        <button class="df-btn" onclick="window.openLegalModal('petitions')">📄 Petições</button>
        <button class="df-btn" onclick="window.openLegalModal('clients')">👥 Clientes</button>
        <button class="df-btn" onclick="window.openLegalModal('processes')">⏳ Prazos CPC</button>
        <button class="df-btn" onclick="window.openLegalModal('contracts')">✍️ ZapSign</button>
        <button class="df-btn" onclick="window.openLegalModal('financeiro')">💰 Financeiro</button>
        <a href="../index.html" class="df-btn df-btn-gold" style="text-decoration:none">📐 Planta 2D Setorial</a>
      </div>
    </header>

    <canvas id="world"></canvas>
    <div id="ui"></div>

    <dialog id="legal-modal">
      <div class="lm-head">
        <h2 id="lm-title">Módulo Jurídico</h2>
        <button class="lm-close" onclick="document.getElementById('legal-modal').close()">✕</button>
      </div>
      <div class="lm-body" id="lm-content"></div>
    </dialog>

    <script>
      window.openLegalModal = function(module) {
        const modal = document.getElementById('legal-modal');
        const title = document.getElementById('lm-title');
        const content = document.getElementById('lm-content');

        if (module === 'telegram') {
          title.textContent = '🎙️ Operação no Telegram · @DanielFelixAdvBot';
          content.innerHTML = \`
            <div class="lm-grid-split">
              <div class="lm-card">
                <span class="lm-badge lm-badge-blue">BOT ATIVO · @DanielFelixAdvBot</span>
                <h3 style="margin:12px 0 6px;font-size:15px">Comandos do Dr. Daniel Felix</h3>
                <p style="font-size:12.5px;color:#a9bac5;line-height:1.5">Clique em um comando rápido ou envie ordens para os agentes:</p>
                <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">
                  <button class="lm-btn-sec" onclick="window.sendTgSim('/resumo')"><strong>/resumo</strong> · Síntese da banca</button>
                  <button class="lm-btn-sec" onclick="window.sendTgSim('/peticoes')"><strong>/peticoes</strong> · Peças prontas</button>
                  <button class="lm-btn-sec" onclick="window.sendTgSim('/clientes')"><strong>/clientes</strong> · Dossiês ativos</button>
                  <button class="lm-btn-sec" onclick="window.sendTgSim('/prazos')"><strong>/prazos</strong> · Prazos CPC Clara</button>
                  <button class="lm-btn-sec" onclick="window.sendTgSim('/financeiro')"><strong>/financeiro</strong> · Honorários e caixa</button>
                </div>
              </div>
              <div class="lm-card" style="display:flex;flex-direction:column;min-height:380px">
                <div id="tg-chat-box" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:10px;padding:10px;background:#0d1820;border-radius:6px;border:1px solid #283a46">
                  <div style="background:#172733;border:1px solid #364e5d;padding:10px;border-radius:6px;font-size:13px">
                    <strong style="color:#78c8a8">@DanielFelixAdvBot:</strong>
                    <div style="margin-top:4px">Dr. Daniel Felix, escritório online e integrado ao motor isométrico 3D Habblaud. 14 agentes posicionados nas 4 salas setoriais. Aguardo ordens de comando.</div>
                  </div>
                </div>
                <div style="display:flex;gap:8px;margin-top:12px">
                  <input id="tg-input" type="text" placeholder="Digite uma ordem ou /comando..." style="flex:1;background:#0e1b24;border:1px solid #3a505e;border-radius:6px;color:#fff;padding:8px 12px;font-size:13px" onkeydown="if(event.key==='Enter')window.sendTgSim(this.value)">
                  <button class="lm-btn-action" onclick="window.sendTgSim(document.getElementById('tg-input').value)">Enviar</button>
                </div>
              </div>
            </div>
          \`;
        } else if (module === 'petitions') {
          title.textContent = '📄 Petições & Minutas Forenses (Maya & Noah)';
          content.innerHTML = \`
            <div class="lm-grid-split">
              <div class="lm-card">
                <span class="lm-badge lm-badge-gold">AGUARDANDO APROVAÇÃO HUMANA</span>
                <h3 style="margin:12px 0 6px;font-size:16px">PEC-2026-001 · Petição Inicial</h3>
                <p style="font-size:12.5px;color:#a9bac5;line-height:1.5"><strong>Cliente:</strong> Maria Carolina Mendes<br><strong>Área:</strong> Direito do Consumidor<br><strong>Redação:</strong> Maya | <strong>Auditoria:</strong> Noah</p>
                <div style="margin-top:16px;display:flex;flex-direction:column;gap:8px">
                  <button class="lm-btn-action" onclick="alert('Petição Inicial Aprovada com Sucesso por Dr. Daniel Felix (OAB/MT 11.158-B). Pronta para protocolo!')">⚖️ Aprovar Petição (Dr. Daniel Felix)</button>
                  <button class="lm-btn-sec" onclick="window.downloadDocTimbrado()">💾 Baixar .DOC Word Timbrado</button>
                </div>
              </div>
              <div class="lm-paper" id="petition-text">EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA ___ª VARA CÍVEL DO FORO CENTRAL DA COMARCA DA CAPITAL - SP

DANIEL FELIX ADVOCACIA
Dr. Daniel Francisco Felix · OAB/MT 11.158-B

MARIA CAROLINA MENDES, brasileira, casada, arquiteta, portadora do RG nº 42.819.302-4 SSP/SP e inscrita no CPF sob o nº 348.912.408-15, residente e domiciliada na Rua Oscar Freire, 1420, Pinheiros, São Paulo/SP, por seu advogado constituído conforme Procuração Ad Judicia anexa, vem respeitosamente perante Vossa Excelência propor:

AÇÃO INDENIZATÓRIA POR DANOS MATERIAIS E MORAIS C/C TUTELA DE URGÊNCIA

em face de COMPANHIA AÉREA LATAM AIRLINES BRASIL, com fulcro nos artigos 186 e 927 do Código Civil, e artigos 6º, VI, e 14 do Código de Defesa do Consumidor.

I. DOS FATOS
A Autora adquiriu bilhete aéreo (Voo LA8084) com destino a Madrid para compromisso profissional inadiável. Sem assistência material adequada, o voo restou cancelado e a bagagem foi extraviada por 4 dias, gerando prejuízos materiais comprovados de R$ 3.840,00 e abalo moral indenizável.

II. DO DIREITO
Conforme precedentes pacificados do Superior Tribunal de Justiça e inteligência do art. 14 do CDC, a responsabilidade do transportador é objetiva...</div>
            </div>
          \`;
        } else if (module === 'clients') {
          title.textContent = '👥 Dossiês 360° de Clientes (Lia & Davi)';
          content.innerHTML = \`
            <div class="lm-grid-split">
              <div class="lm-card">
                <span class="lm-badge lm-badge-green">CLIENTE ATIVA · CONTRATO ASSINADO</span>
                <h3 style="margin:12px 0 6px;font-size:16px">Maria Carolina Mendes</h3>
                <p style="font-size:12.5px;color:#a9bac5;line-height:1.5">CPF: 348.912.408-15<br>WhatsApp: (11) 99812-4401<br>Origem: Lia (SDR WhatsApp)</p>
                <div style="margin-top:16px;border-top:1px solid #2e4350;padding-top:12px">
                  <strong style="font-size:12px;color:#dfc082">Honorários:</strong>
                  <div style="font-size:14px;font-weight:600;margin-top:4px">R$ 4.500,00 fixos + 20% êxito</div>
                  <div style="font-size:12px;color:#78c8a8;margin-top:2px">Pago: R$ 2.250,00 | Saldo: R$ 2.250,00</div>
                </div>
              </div>
              <div class="lm-card">
                <h4 style="margin:0 0 10px;color:#e5d0a6">Documentos Validados por Eva:</h4>
                <div style="display:flex;flex-direction:column;gap:6px;font-size:13px">
                  <div style="padding:8px;background:#101d26;border-radius:4px;border:1px solid #2a3d49">✓ RG_CPF_Maria_Carolina.pdf <span class="lm-badge lm-badge-green">Verificado</span></div>
                  <div style="padding:8px;background:#101d26;border-radius:4px;border:1px solid #2a3d49">✓ Bilhetes_E_BoardingPass_LATAM.pdf <span class="lm-badge lm-badge-green">Verificado</span></div>
                  <div style="padding:8px;background:#101d26;border-radius:4px;border:1px solid #2a3d49">✓ Protocolo_RIB_Extravio_Bagagem.pdf <span class="lm-badge lm-badge-green">Verificado</span></div>
                  <div style="padding:8px;background:#101d26;border-radius:4px;border:1px solid #2a3d49">✓ Procuracao_Ad_Judicia_ZapSign.pdf <span class="lm-badge lm-badge-gold">Assinada 2/2</span></div>
                </div>
              </div>
            </div>
          \`;
        } else if (module === 'processes') {
          title.textContent = '⏳ Prazos Processuais & Calculadora CPC (Clara)';
          content.innerHTML = \`
            <div class="lm-grid-split">
              <div class="lm-card">
                <span class="lm-badge lm-badge-gold">CALCULADORA DETERMINÍSTICA CPC</span>
                <h3 style="margin:12px 0 6px;font-size:15px">Simular Prazo em Dias Úteis</h3>
                <div style="margin-top:10px;display:flex;flex-direction:column;gap:8px">
                  <label style="font-size:12px;color:#a9bac5">Data de Publicação:</label>
                  <input id="calc-pub" type="date" value="2026-10-15" style="background:#0e1b24;border:1px solid #3a505e;border-radius:4px;color:#fff;padding:6px">
                  <label style="font-size:12px;color:#a9bac5">Prazo Legal:</label>
                  <select id="calc-days" style="background:#0e1b24;border:1px solid #3a505e;border-radius:4px;color:#fff;padding:6px">
                    <option value="15">15 dias úteis (Apelação / Contestação CPC)</option>
                    <option value="5">5 dias úteis (Embargos de Declaração)</option>
                  </select>
                  <button class="lm-btn-action" style="margin-top:8px" onclick="window.calcularPrazo()">Calcular Prazo Fatal</button>
                  <div id="calc-result" style="margin-top:10px;font-size:13px;color:#78c8a8;font-weight:600"></div>
                </div>
              </div>
              <div class="lm-card">
                <h4 style="margin:0 0 10px;color:#e5d0a6">Prazos Fatais da Semana (Clara):</h4>
                <div style="display:flex;flex-direction:column;gap:8px;font-size:13px">
                  <div style="padding:10px;background:#101d26;border-radius:6px;border:1px solid #2c414e">
                    <strong style="color:#f2d596">Contestação Cível · Maria Carolina Mendes</strong>
                    <div style="color:#a8bac5;font-size:12px;margin-top:2px">Vencimento: 22/10/2026 (7 dias restantes) · Tribunal: TJSP</div>
                    <span class="lm-badge lm-badge-gold" style="margin-top:4px">Sugestão Clara · Aguarda confirmação</span>
                  </div>
                </div>
              </div>
            </div>
          \`;
        } else if (module === 'contracts') {
          title.textContent = '✍️ Contratos & ZapSign (Bia & Davi)';
          content.innerHTML = \`
            <div class="lm-grid-split">
              <div class="lm-card">
                <span class="lm-badge lm-badge-green">ZAPSIGN · 2/2 ASSINATURAS CONCLUÍDAS</span>
                <h3 style="margin:12px 0 6px;font-size:15px">Procuração Ad Judicia & Contrato</h3>
                <p style="font-size:12.5px;color:#a9bac5;line-height:1.5">Artigo 105 do CPC · Poderes expressos para o foro em geral, transigir e firmar acordos.</p>
                <div style="margin-top:14px;display:flex;flex-direction:column;gap:8px">
                  <button class="lm-btn-sec" onclick="alert('Webhook ZapSign validado com sucesso!')">🔄 Reconciliar Webhook ZapSign</button>
                </div>
              </div>
              <div class="lm-card">
                <h4 style="margin:0 0 10px;color:#e5d0a6">Signatários:</h4>
                <div style="padding:8px;background:#101d26;border-radius:4px;border:1px solid #2a3d49;font-size:13px">1. Dr. Daniel Francisco Felix (OAB/MT 11.158-B) - <span style="color:#78c8a8">Assinado</span></div>
                <div style="padding:8px;background:#101d26;border-radius:4px;border:1px solid #2a3d49;font-size:13px;margin-top:6px">2. Maria Carolina Mendes - <span style="color:#78c8a8">Assinado</span></div>
              </div>
            </div>
          \`;
        } else if (module === 'financeiro') {
          title.textContent = '💰 Gestão Financeira e Honorários (Rui)';
          content.innerHTML = \`
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:16px">
              <div class="lm-card"><small style="color:#9eb3bf;font-size:11px">TOTAL CONTRATADO</small><div style="font-size:20px;font-weight:700;color:#dfc082;margin-top:4px">R$ 38.400,00</div></div>
              <div class="lm-card"><small style="color:#9eb3bf;font-size:11px">HONORÁRIOS RECEBIDOS</small><div style="font-size:20px;font-weight:700;color:#78c8a8;margin-top:4px">R$ 18.250,00</div></div>
              <div class="lm-card"><small style="color:#9eb3bf;font-size:11px">A RECEBER</small><div style="font-size:20px;font-weight:700;color:#85bbf0;margin-top:4px">R$ 20.150,00</div></div>
            </div>
          \`;
        }
        modal.showModal();
      };

      window.sendTgSim = function(txt) {
        if (!txt || !txt.trim()) return;
        const box = document.getElementById('tg-chat-box');
        const userMsg = document.createElement('div');
        userMsg.style.cssText = 'background:#1f3545;border:1px solid #3c6580;padding:8px 12px;border-radius:6px;align-self:flex-end;font-size:13px;max-width:85%';
        userMsg.innerHTML = '<strong>Dr. Daniel Felix:</strong> ' + txt;
        box.appendChild(userMsg);
        document.getElementById('tg-input').value = '';
        setTimeout(() => {
          const botMsg = document.createElement('div');
          botMsg.style.cssText = 'background:#142430;border:1px solid #2e4656;padding:8px 12px;border-radius:6px;font-size:13px';
          let resposta = 'Comando processado com sucesso pelos agentes.';
          if (txt.includes('/resumo')) resposta = '📋 <strong>Resumo Geral:</strong> 14 agentes ativos nas 4 salas. 1 petição para revisar (PEC-2026-001). 1 prazo fatal em 7 dias da Clara. Caixa com R$ 18.250 recebidos.';
          else if (txt.includes('/peticoes')) resposta = '✍️ <strong>Petições:</strong> Minuta da Tutela de Urgência pronta. Aguardando sua aprovação.';
          botMsg.innerHTML = '<strong style="color:#78c8a8">@DanielFelixAdvBot:</strong> ' + resposta;
          box.appendChild(botMsg);
          box.scrollTop = box.scrollHeight;
        }, 350);
      };

      window.calcularPrazo = function() {
        const pub = document.getElementById('calc-pub').value;
        const days = parseInt(document.getElementById('calc-days').value, 10);
        let d = new Date(pub);
        let added = 0;
        while (added < days) {
          d.setDate(d.getDate() + 1);
          if (d.getDay() !== 0 && d.getDay() !== 6) added++;
        }
        document.getElementById('calc-result').innerHTML = '✓ Prazo Fatal Fatal (CPC): <strong>' + d.toLocaleDateString('pt-BR') + ' às 23:59</strong> (' + days + ' dias úteis conforme Art. 219 CPC).';
      };

      window.downloadDocTimbrado = function() {
        const text = document.getElementById('petition-text').innerText;
        const blob = new Blob([
          '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Petição Timbrada</title></head><body style="font-family:Georgia,serif;line-height:1.8;padding:40px">' +
          '<div style="text-align:center;border-bottom:2px solid #333;padding-bottom:15px;margin-bottom:30px"><h2>DANIEL FELIX ADVOCACIA</h2><p>Dr. Daniel Francisco Felix · OAB/MT 11.158-B</p></div>' +
          '<pre style="font-family:Georgia,serif;white-space:pre-wrap">' + text + '</pre>' +
          '</body></html>'
        ], { type: 'application/msword;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'Peticao_Inicial_Timbrada_Daniel_Felix.doc';
        a.click();
      };
    </script>
  </body>
</html>`;

writeFileSync('habblaud/index.html', html, 'utf8');
console.log('habblaud/index.html written successfully!');
