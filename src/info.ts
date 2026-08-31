export function infoHtml() {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Nómada API · Info</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #07111f;
      --bg-2: #10243f;
      --card: rgba(8, 18, 34, 0.76);
      --line: rgba(255,255,255,.10);
      --text: #eaf2ff;
      --muted: #9fb4cf;
      --accent: #7ce7d6;
      --accent-2: #ffcb6b;
      --shadow: 0 24px 80px rgba(0,0,0,.45);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(124,231,214,.18), transparent 30%),
        radial-gradient(circle at right center, rgba(255,203,107,.13), transparent 28%),
        linear-gradient(160deg, var(--bg), var(--bg-2));
      overflow-x: hidden;
    }
    .wrap {
      position: relative;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 32px;
    }
    .grid {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px);
      background-size: 54px 54px;
      mask-image: radial-gradient(circle at center, black 28%, transparent 78%);
      opacity: .28;
      animation: drift 24s linear infinite;
      pointer-events: none;
    }
    .card {
      position: relative;
      width: min(1080px, 100%);
      display: grid;
      grid-template-columns: 1.05fr .95fr;
      gap: 28px;
      padding: 28px;
      border: 1px solid var(--line);
      border-radius: 28px;
      background: var(--card);
      backdrop-filter: blur(18px);
      box-shadow: var(--shadow);
      overflow: hidden;
      animation: pop .7s cubic-bezier(.2,.9,.2,1) both;
    }
    .card::before {
      content: "";
      position: absolute;
      inset: -1px;
      background: linear-gradient(135deg, rgba(124,231,214,.22), transparent 28%, transparent 72%, rgba(255,203,107,.20));
      pointer-events: none;
      opacity: .7;
    }
    .hero, .panel { position: relative; z-index: 1; }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 8px 14px;
      border-radius: 999px;
      background: rgba(255,255,255,.06);
      border: 1px solid var(--line);
      color: var(--muted);
      font-size: 13px;
      letter-spacing: .08em;
      text-transform: uppercase;
      margin-bottom: 18px;
    }
    h1 {
      margin: 0;
      font-size: clamp(44px, 7vw, 88px);
      line-height: .94;
      letter-spacing: -.05em;
    }
    .accent {
      color: var(--accent);
      text-shadow: 0 0 24px rgba(124,231,214,.22);
    }
    .sub {
      margin: 18px 0 0;
      max-width: 52ch;
      color: var(--muted);
      font-size: 17px;
      line-height: 1.7;
    }
    .meta {
      margin-top: 28px;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }
    .chip {
      padding: 14px 16px;
      border-radius: 18px;
      background: rgba(255,255,255,.05);
      border: 1px solid var(--line);
    }
    .chip span {
      display: block;
      font-size: 12px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: .08em;
      margin-bottom: 6px;
    }
    .chip strong { font-size: 16px; }
    .poster {
      display: grid;
      gap: 18px;
      align-content: start;
    }
    .art {
      position: relative;
      border-radius: 26px;
      min-height: 420px;
      border: 1px solid var(--line);
      background:
        radial-gradient(circle at 24% 18%, rgba(124,231,214,.25), transparent 22%),
        radial-gradient(circle at 74% 30%, rgba(255,203,107,.22), transparent 24%),
        linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.03));
      overflow: hidden;
    }
    .art::before {
      content: "";
      position: absolute;
      inset: 18px;
      border-radius: 20px;
      border: 1px solid rgba(255,255,255,.09);
      background:
        linear-gradient(135deg, rgba(255,255,255,.04), rgba(255,255,255,0)),
        radial-gradient(circle at 50% 18%, rgba(124,231,214,.18), transparent 32%);
    }
    .passport {
      position: absolute;
      inset: 56px 52px 72px 52px;
      border-radius: 24px;
      background:
        linear-gradient(180deg, rgba(9,26,43,.96), rgba(5,12,23,.96));
      border: 1px solid rgba(255,255,255,.10);
      box-shadow: 0 18px 50px rgba(0,0,0,.35);
      transform: perspective(1000px) rotateY(-10deg) rotateX(8deg);
      animation: float 5.5s ease-in-out infinite;
    }
    .passport .topline {
      display: flex;
      justify-content: space-between;
      padding: 18px 20px 10px;
      color: var(--muted);
      font-size: 12px;
      letter-spacing: .1em;
      text-transform: uppercase;
    }
    .passport .seal {
      width: 120px;
      height: 120px;
      margin: 14px auto;
      border-radius: 50%;
      border: 1px dashed rgba(124,231,214,.55);
      display: grid;
      place-items: center;
      color: var(--accent);
      font-weight: 700;
      font-size: 34px;
      box-shadow: 0 0 0 10px rgba(124,231,214,.06), 0 0 40px rgba(124,231,214,.18);
    }
    .passport .lines {
      padding: 10px 22px 22px;
      display: grid;
      gap: 12px;
    }
    .line {
      height: 12px;
      border-radius: 99px;
      background: linear-gradient(90deg, rgba(255,255,255,.08), rgba(124,231,214,.45), rgba(255,203,107,.45));
      background-size: 200% 100%;
      animation: shine 3s linear infinite;
    }
    .line.sm { width: 68%; opacity: .7; }
    .line.md { width: 84%; }
    .line.lg { width: 96%; }
    .footer {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-top: 16px;
      color: var(--muted);
      font-size: 14px;
      flex-wrap: wrap;
    }
    .badge {
      padding: 10px 14px;
      border-radius: 999px;
      background: rgba(255,255,255,.06);
      border: 1px solid var(--line);
    }
    @keyframes float {
      0%,100% { transform: perspective(1000px) rotateY(-10deg) rotateX(8deg) translateY(0); }
      50% { transform: perspective(1000px) rotateY(-12deg) rotateX(10deg) translateY(-10px); }
    }
    @keyframes shine {
      from { background-position: 0% 0; }
      to { background-position: 200% 0; }
    }
    @keyframes pop {
      from { opacity: 0; transform: translateY(18px) scale(.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes drift {
      from { transform: translate3d(0,0,0); }
      to { transform: translate3d(-54px,-54px,0); }
    }
    @media (max-width: 920px) {
      .card { grid-template-columns: 1fr; }
      .meta { grid-template-columns: 1fr; }
      .art { min-height: 360px; }
      .passport { inset: 44px 28px 58px 28px; }
    }
  </style>
</head>
<body>
  <main class="wrap">
    <div class="grid"></div>
    <section class="card">
      <div class="hero">
        <div class="eyebrow">Nómada API · Backend oficial</div>
        <h1>Este es el backend de <span class="accent">Nómada</span></h1>
        <p class="sub">
          API desplegada en Cloudflare Workers, conectada a PostgreSQL por Hyperdrive y a buckets R2
          para fotos y documentos. Esta página sirve como entrada visual, estado público y referencia de versión.
        </p>
        <div class="meta">
          <div class="chip"><span>Versión</span><strong>v1.0.0</strong></div>
          <div class="chip"><span>Publicado</span><strong>31 de agosto de 2026</strong></div>
          <div class="chip"><span>Dominio</span><strong>api-nomada.innovasoftgt.com</strong></div>
        </div>
        <div class="footer">
          <div class="badge">Swagger: /api/v1/docs</div>
          <div class="badge">OpenAPI: /api/v1/openapi.json</div>
          <div class="badge">Health: /api/v1/health</div>
        </div>
      </div>
      <div class="poster">
        <div class="art" aria-hidden="true">
          <div class="passport">
            <div class="topline"><span>Nómada</span><span>Explora Guatemala</span></div>
            <div class="seal">N</div>
            <div class="lines">
              <div class="line lg"></div>
              <div class="line md"></div>
              <div class="line sm"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
</body>
</html>`;
}
