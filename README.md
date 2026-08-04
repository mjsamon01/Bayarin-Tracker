# Bayarin Tracker (PWA)

Standalone na bills tracker app — pwedeng i-install sa phone o desktop na may sariling icon.

## Paano i-deploy sa GitHub Pages (libre, walang code na isusulat)

1. **Gumawa ng GitHub account** kung wala ka pa: https://github.com/signup

2. **Gumawa ng bagong repository**
   - Sa GitHub, click ang "+" sa taas → "New repository"
   - Pangalanan ito ng `bayarin-tracker` (o kahit ano)
   - Piliin **Public**
   - Click "Create repository"

3. **I-upload ang mga files dito**
   - Sa page ng bagong repo mo, click "uploading an existing file"
   - I-drag-and-drop LAHAT ng laman ng folder na ito (index.html, style.css, app.js, sw.js, manifest.json, at yung `icons` folder)
   - Mag-scroll pababa, click "Commit changes"

4. **I-on ang GitHub Pages**
   - Sa repo mo, punta sa "Settings" tab
   - Sa left sidebar, click "Pages"
   - Sa ilalim ng "Branch", piliin `main` at `/ (root)`, click "Save"
   - Maghintay ng 1-2 minuto

5. **Kunin ang link mo**
   - Babalik ka sa parehong Settings > Pages page, may lalabas na link tulad ng:
     `https://<username>.github.io/bayarin-tracker/`
   - Yan na ang totoong website mo — pwede mo nang i-share kahit kanino!

## Paano i-install bilang app (may icon)

**Sa Android (Chrome):**
- Buksan ang link mo sa Chrome
- May lalabas na "I-install" banner sa app, o tap ang ⋮ menu → "Install app" / "Add to Home screen"

**Sa iPhone (Safari):**
- Buksan ang link mo sa Safari
- Tap ang Share icon (kahon na may pataas na arrow)
- Piliin "Add to Home Screen"

**Sa Desktop (Chrome/Edge):**
- Buksan ang link
- May icon na lalabas sa address bar (⊕ o computer icon) — click "Install"

Pagkatapos, may icon na siya sa home screen o desktop mo, gaya ng totoong app.

## Tungkol sa data mo

Naka-save ang data sa **localStorage** ng browser mo — ibig sabihin nasa device mo lang ito (hindi tulad ng Claude version na cross-device). Kung mag-clear ka ng browser data o gumamit ng ibang device, hindi ito magkakasama. Kung kailangan mo ng cross-device sync, sabihin mo lang at may pwede tayong idagdag na simpleng backend.
