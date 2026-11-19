import { readdirSync, writeFileSync } from 'node:fs';
import { initialState } from '../prototipo/src/model.mjs';
import { buildHabblaudSnapshot, buildHabblaudFeed } from '../adaptadores/habblaud-adapter.mjs';

const state = initialState();
const snapshot = buildHabblaudSnapshot(state);
const feed = buildHabblaudFeed(state);

writeFileSync('habblaud/initial-snapshot.json', JSON.stringify(snapshot, null, 2), 'utf8');
writeFileSync('habblaud/initial-feed.json', JSON.stringify(feed, null, 2), 'utf8');

const bundleFiles = readdirSync('habblaud/bundle');
const mainBundle = bundleFiles.find((f) => /^main-[\w-]+\.js$/.test(f));
if (!mainBundle) {
  throw new Error('Bundle principal main-*.js não encontrado em habblaud/bundle/');
}

const embedHtml = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="color-scheme" content="dark" />
    <meta name="theme-color" content="#12151d" />
    <title>Daniel Felix Advocacia · Motor 3D Habblaud</title>
    <link rel="icon" href="./assets/brand/favicon-32.png" type="image/png" sizes="32x32" />
    <style>
      html,body{background:#12151d;height:100%;width:100%;margin:0;overflow:hidden}
      #world,#city,#visit{width:100vw;height:100vh;image-rendering:pixelated;display:block;position:fixed;inset:0;outline:none}
      #world[hidden],#city[hidden],#visit[hidden]{display:none}
      #ui{pointer-events:none;position:fixed;inset:0}
      #ui>*{pointer-events:auto}
    </style>
    <script>
      window.__OFFICE_BRAND__ = 'DANIEL FELIX';
      window.__LEGAL_SNAPSHOT__ = ${JSON.stringify(snapshot)};
      window.__LEGAL_FEED__ = ${JSON.stringify(feed)};
    </script>
    <script type="module" crossorigin src="./bundle/${mainBundle}"></script>
  </head>
  <body>
    <canvas id="world"></canvas>
    <div id="ui"></div>
  </body>
</html>
`;

const redirectHtml = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="refresh" content="0;url=../index.html" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Daniel Felix Advocacia · Escritório Virtual Unificado</title>
    <style>
      html,body{height:100%;margin:0;background:#101a22;color:#f2efe9;font-family:Inter,system-ui,sans-serif;display:grid;place-items:center}
      .box{max-width:440px;padding:28px;border:1px solid #2e404b;border-radius:12px;background:#17242e;text-align:center}
      h1{font-family:Georgia,serif;font-size:22px;margin:0 0 10px;color:#dfc082}
      p{font-size:14px;color:#b4c4ce;line-height:1.5;margin:0 0 18px}
      a{display:inline-block;padding:10px 18px;border-radius:7px;background:#dbb97c;color:#172026;font-weight:700;text-decoration:none}
    </style>
    <script>window.location.replace('../index.html');</script>
  </head>
  <body>
    <div class="box">
      <h1>Escritório Virtual Daniel Felix</h1>
      <p>O motor isométrico 3D Habblaud agora roda integrado diretamente no escritório principal, com todos os módulos, petições, clientes, Telegram e financeiro.</p>
      <a href="../index.html">Abrir Escritório Unificado</a>
    </div>
  </body>
</html>
`;

writeFileSync('habblaud/embed.html', embedHtml, 'utf8');
writeFileSync('habblaud/index.html', redirectHtml, 'utf8');
console.log(`Habblaud build atualizado: bundle=${mainBundle}, ${snapshot.rooms.length} salas, ${snapshot.agents.length} agentes.`);
