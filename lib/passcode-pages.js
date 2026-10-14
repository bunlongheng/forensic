// The passcode lock screen, ported from Stickies (app/api/stickies/public/raw/
// route.ts gatePage). A right passcode goes to the board, which plays its
// reveal (src/components/UnlockReveal.jsx). Pure HTML builders: no React, no DB,
// and the page ships 0 JavaScript.

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const HEAD = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">`;

/** Liquid glass lock: an optical glass card (the backdrop barely blurred and
 *  bent through an SVG displacement map, a thin white tint, a specular rim,
 *  crisp content) with the title, 1 masked field, Enter submits. With a
 *  `backdrop` (a small PNG data URI of the board) the card sits on that board,
 *  softened just enough to stay a shape; without one, on a softly lit room. */
export function gatePage({ action, title, bad, backdrop }) {
  const bg = typeof backdrop === "string" && backdrop.startsWith("data:image/png;base64,") ? backdrop : null;
  const alert = bad ? `<div class="alert" role="alert">Wrong passcode</div>` : `<div class="alert hidden">&nbsp;</div>`;
  return `<!DOCTYPE html><html lang="en"${bg ? ` class="has-blur"` : ""}><head>
${HEAD}
<title>${esc(title)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;color:#0f172a;font-family:Inter,-apple-system,BlinkMacSystemFont,'SF Pro Display',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
body{background:
  radial-gradient(55% 60% at 8% 4%,rgba(255,255,255,0.6) 0%,rgba(255,255,255,0) 75%),
  radial-gradient(42% 48% at 90% 6%,rgba(176,222,255,0.26) 0%,rgba(176,222,255,0) 75%),
  linear-gradient(160deg,#f6f7fb 0%,#eef0f5 100%)}
.room{min-height:100%;display:flex;align-items:center;justify-content:center;padding:32px 16px}
/* ── liquid glass ──────────────────────────────────────────────────────────
   4 layers: the lens (backdrop, barely blurred, bent through an SVG
   displacement map), a thin white overlay, the specular rim, the content. */
.glass{position:relative;width:100%;max-width:440px;padding:40px;border-radius:36px;text-align:center;isolation:isolate;
  box-shadow:0 2px 4px rgba(40,45,60,0.05),0 24px 60px -18px rgba(40,45,60,0.22);
  animation:rise 450ms cubic-bezier(.2,.8,.2,1) both}
.lens{position:absolute;inset:0;border-radius:inherit;z-index:0;overflow:hidden;
  -webkit-backdrop-filter:blur(2.5px) saturate(160%) brightness(1.04);backdrop-filter:blur(2.5px) saturate(160%) brightness(1.04);
  filter:url(#lens-bend)}
.tint{position:absolute;inset:0;border-radius:inherit;z-index:1;pointer-events:none;
  background:
    linear-gradient(118deg,rgba(255,255,255,0) 32%,rgba(255,255,255,0.42) 46%,rgba(255,255,255,0.1) 54%,rgba(255,255,255,0) 66%),
    radial-gradient(70% 55% at 50% 42%,rgba(255,255,255,0.3) 0%,rgba(255,255,255,0) 100%),
    radial-gradient(50% 36% at 0% 0%,rgba(255,255,255,0.3) 0%,rgba(255,255,255,0) 70%),
    radial-gradient(50% 36% at 100% 100%,rgba(255,255,255,0.28) 0%,rgba(255,255,255,0) 70%),
    rgba(255,255,255,0.22)}
/* gloss: a crisp white lip top-left, a soft inner glow, a softer lip bottom-right */
.shine{position:absolute;inset:0;border-radius:inherit;z-index:2;pointer-events:none;
  box-shadow:
    inset 1.5px 1.5px 0 rgba(255,255,255,0.9),
    inset -1px -1px 0 rgba(255,255,255,0.5),
    inset 0 0 0 1px rgba(255,255,255,0.3),
    inset 0 0 22px rgba(255,255,255,0.6),
    inset 3px 6px 28px -14px rgba(255,255,255,1),
    inset -4px -10px 34px -18px rgba(255,255,255,0.85)}
/* bubble rim: a 1px conic sweep that fades in and out of the glass, mostly white */
.glass::before{content:"";position:absolute;inset:0;border-radius:inherit;padding:1px;pointer-events:none;z-index:3;
  background:conic-gradient(from 210deg at 50% 50%,
    rgba(255,255,255,0.85) 0deg,rgba(255,255,255,0.55) 28deg,rgba(255,255,255,0.4) 50deg,rgba(255,255,255,0.7) 82deg,
    rgba(205,232,255,0.45) 118deg,rgba(200,240,246,0.3) 150deg,rgba(255,255,255,0.2) 185deg,rgba(255,255,255,0.35) 225deg,
    rgba(255,255,255,0.3) 262deg,rgba(255,255,255,0.45) 300deg,rgba(255,255,255,0.85) 360deg);
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude}
/* lens flares held to the edges */
.glass::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:2;
  background:
    radial-gradient(6px 6px at 9% 7%,rgba(255,255,255,1) 0%,rgba(255,255,255,0.9) 40%,rgba(255,255,255,0) 100%),
    radial-gradient(22% 14% at 6% 5%,rgba(255,255,255,0.7) 0%,rgba(255,255,255,0) 100%),
    linear-gradient(125deg,rgba(255,255,255,0) 4%,rgba(255,255,255,0.8) 9%,rgba(255,255,255,0) 15%),
    radial-gradient(18% 10% at 94% 4%,rgba(255,255,255,0.6) 0%,rgba(255,255,255,0) 100%),
    radial-gradient(20% 14% at 4% 96%,rgba(165,230,245,0.35) 0%,rgba(165,230,245,0) 100%),
    radial-gradient(26% 18% at 96% 97%,rgba(255,255,255,0.7) 0%,rgba(255,255,255,0) 100%),
    radial-gradient(60% 9% at 88% 100%,rgba(255,255,255,0.6) 0%,rgba(255,255,255,0) 100%)}
.glass>.body{position:relative;z-index:4}
@keyframes rise{from{opacity:0;transform:translateY(8px) scale(0.97)}to{opacity:1;transform:none}}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){
  .tint{background:rgba(255,255,255,0.86)}
  .entry{background:rgba(255,255,255,0.9)}}
/* ── content ───────────────────────────────────────────────────────────── */
.logo{display:block;margin:0 auto 18px;width:76px;height:76px;border-radius:20px;box-shadow:0 10px 26px rgba(28,30,33,0.28),inset 0 0 0 1px rgba(255,255,255,0.3)}
.name{font-size:22px;line-height:1.2;font-weight:700;letter-spacing:-0.03em;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 0 rgba(255,255,255,0.6)}
.caption{font-size:13.5px;color:#525b70;margin-top:6px;line-height:1.5}
.alert{margin:16px 0 -8px;font-size:13.5px;font-weight:600;color:#d92d20;animation:shake 0.4s ease-in-out}
@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
.alert.hidden{visibility:hidden;animation:none}
/* the field is a thinner slab of the same glass */
.entry{margin-top:28px;height:64px;display:flex;align-items:center;gap:6px;padding:0 10px 0 18px;border-radius:20px;
  background:linear-gradient(180deg,rgba(255,255,255,0.4) 0%,rgba(255,255,255,0.16) 100%);
  -webkit-backdrop-filter:blur(3px) saturate(150%);backdrop-filter:blur(3px) saturate(150%);
  box-shadow:inset 1px 1.5px 0 rgba(255,255,255,0.95),inset -1px -1px 0 rgba(255,255,255,0.5),inset 0 0 0 1px rgba(255,255,255,0.35),inset 0 0 12px rgba(255,255,255,0.45),0 8px 20px -12px rgba(40,45,60,0.22);
  transition:box-shadow .15s}
.entry:focus-within{box-shadow:inset 1px 1.5px 0 rgba(255,255,255,0.95),inset -1px -1px 0 rgba(255,255,255,0.5),inset 0 0 0 1px rgba(255,255,255,0.35),inset 0 0 12px rgba(255,255,255,0.45),0 8px 20px -12px rgba(40,45,60,0.22),0 0 0 4px rgba(255,255,255,0.7)}
.entry svg.lock{flex:none;width:22px;height:22px;color:#525b70}
/* type=text + text-security masks input WITHOUT being a password field, so
   LastPass/1Password never attach their autofill icon. */
.entry input{flex:1;min-width:0;background:transparent;border:0;outline:0;color:#1f2937;font-size:17px;font-weight:600;font-family:inherit;letter-spacing:0.18em;padding:12px 0;-webkit-text-security:disc;text-security:disc}
.entry input::placeholder{color:#6f7891;font-weight:400;letter-spacing:0.01em}
/* eye: a hidden checkbox flips the masking off, no script */
.peek{flex:none;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;cursor:pointer;color:#525b70;transition:background .12s}
.peek:hover{background:rgba(255,255,255,0.45)}
.peek input{position:absolute;opacity:0;width:1px;height:1px;pointer-events:none}
.peek svg{width:22px;height:22px}
.peek .off{display:none}
.entry:has(.peek input:checked) input[name=passcode]{-webkit-text-security:none;text-security:none;letter-spacing:0.02em}
.entry:has(.peek input:checked) .peek .on{display:none}
.entry:has(.peek input:checked) .peek .off{display:block}
.peek:has(input:focus-visible){outline:3px solid rgba(255,255,255,0.9);outline-offset:1px}
/* the submit is a small clear glass bubble */
.go{position:relative;flex:none;width:44px;height:44px;border:0;border-radius:50%;cursor:pointer;display:grid;place-items:center;color:#0f172a;overflow:hidden;
  background:rgba(255,255,255,0.1);
  -webkit-backdrop-filter:blur(1.5px) saturate(150%);backdrop-filter:blur(1.5px) saturate(150%);
  box-shadow:inset 1px 1.5px 0 rgba(255,255,255,0.95),inset -1px -1.5px 0 rgba(255,255,255,0.5),inset 0 0 0 1px rgba(255,255,255,0.3),0 8px 18px -8px rgba(40,45,60,0.3);transition:transform .12s,box-shadow .12s}
.go::before{content:"";position:absolute;left:16%;top:6%;width:68%;height:42%;border-radius:50%;pointer-events:none;
  background:linear-gradient(180deg,rgba(255,255,255,0.5) 0%,rgba(255,255,255,0) 100%)}
.go:hover{transform:translateY(-1px)}
.go:active{transform:translateY(0) scale(0.97)}
.go:focus-visible{outline:3px solid rgba(255,255,255,0.9);outline-offset:2px}
.go svg{width:18px;height:18px;position:relative}
/* the board's shape behind the gate: softened a touch, sharp enough to bend */
.blur{position:fixed;inset:-40px;z-index:0;background:#f4f5fa url("${bg || ""}") center/cover no-repeat;filter:blur(3px)}
.veil{position:fixed;inset:0;z-index:0;background:
  radial-gradient(55% 60% at 8% 4%,rgba(255,255,255,0.5) 0%,rgba(255,255,255,0) 75%),
  radial-gradient(42% 48% at 90% 6%,rgba(176,222,255,0.22) 0%,rgba(176,222,255,0) 75%),
  rgba(255,255,255,0.18)}
.has-blur .room{position:relative;z-index:1}
@media (prefers-reduced-motion:reduce){.glass,.alert,.go,.entry{animation:none;transition:none}}
</style>
</head><body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="lens-bend" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.0025 0.004" numOctaves="1" seed="7" result="noise"/>
  <feGaussianBlur in="noise" stdDeviation="4" result="map"/>
  <feDisplacementMap in="SourceGraphic" in2="map" scale="90" xChannelSelector="R" yChannelSelector="G"/>
</filter></svg>
${bg ? `<div class="blur" aria-hidden="true"></div><div class="veil" aria-hidden="true"></div>` : ""}
<div class="room">
<form class="glass" method="POST" action="${esc(action)}">
  <div class="lens" aria-hidden="true"></div><div class="tint" aria-hidden="true"></div><div class="shine" aria-hidden="true"></div>
  <div class="body">
  <img class="logo" src="/icon-192.png" alt="Forensic" width="76" height="76">
  <div class="name">${esc(title)}</div>
  <div class="caption">Protected board</div>
  ${alert}

  <div class="entry">
    <svg class="lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/></svg>
    <input name="passcode" type="text" autofocus autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore data-bwignore data-form-type="other" required placeholder="Passcode" aria-label="Passcode">
    <label class="peek" title="Show passcode"><input type="checkbox" aria-label="Show passcode">
      <svg class="on" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>
      <svg class="off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.8A10 10 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.2 4"/><path d="M6.6 6.6A16 16 0 0 0 2.5 12s3.5 6.5 9.5 6.5a9.6 9.6 0 0 0 4.4-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>
    </label>
    <button class="go" type="submit" aria-label="Open board"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
  </div>
  </div>
</form>
</div>
</body></html>`;
}
