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

Naka-save ang data sa **localStorage** ng browser mo bilang backup, PERO kung susundan mo ang setup sa ibaba, magkakaroon ka ng **cross-device sync** gamit ang Firebase (libreng Google service).

## Paano i-setup ang Cloud Sync (Firebase) — libre

1. **Gumawa ng Firebase project**
   - Pumunta sa https://console.firebase.google.com
   - Mag-login gamit ang Google account mo
   - Click "Add project" / "Create a project"
   - Bigyan ng pangalan (hal. `bayarin-tracker`), click "Continue" hanggang matapos (pwede i-off yung Google Analytics option)

2. **Gumawa ng Realtime Database**
   - Sa loob ng project mo, sa left sidebar, hanapin ang "Build" → click "Realtime Database"
   - Click "Create Database"
   - Piliin ang location (kahit alin), click "Next"
   - Piliin **"Start in test mode"**, click "Enable"
   - ⚠️ Tandaan: "test mode" ay bukas ang access sa sinumang may alam ng database URL/path — sapat na ito para sa personal na bill tracker, pero huwag ilagay dito ang sensitibong impormasyon (hal. buong credit card number).

3. **Kunin ang config keys mo**
   - Sa Firebase Console, click ang ⚙️ gear icon sa tabi ng "Project Overview" → "Project settings"
   - Mag-scroll pababa sa "Your apps", click ang `</>` (Web) icon para gumawa ng web app
   - Bigyan ng pangalan (hal. "bayarin-web"), click "Register app"
   - May lalabas na code na may `firebaseConfig = { apiKey: ..., authDomain: ..., ... }` — kopyahin ang buong bagay na ito

4. **I-paste sa `firebase-config.js`**
   - Buksan ang file na `firebase-config.js` (sa GitHub, i-click ang file → pencil/edit icon)
   - Palitan ang mga `"PALITAN_MO_ITO"` ng totoong values mula sa Firebase config mo
   - I-commit/save ang changes

5. **Tapos na!**
   - I-refresh ang site mo — may lalabas na banner na "Sync code: [random code]"
   - Sa ibang device, buksan din ang site, click "Palitan / Ikonekta", i-type ang parehong sync code
   - Magkakasama na ang data mo sa dalawang device — real-time pa ang pag-sync

Kung gusto mong palitan sa isang random code para hindi mahulaan ng iba, tandaan lang ang code mo (parang password) at wag i-share sa hindi mo gustong makakita ng data mo.

## Login, Approval, at Privacy ng Bawat User

Bago ka lang: kailangan na ngayon ng account (email + password) para magamit ang app. Ganito ito gumagana:

- **Bagong user** → gagawa ng account (email + password na sila mismo pipili) → makikita nila ang "Naghihintay ng Approval" screen
- **Ikaw lang (base sa email mong ilalagay sa `ADMIN_EMAIL`)** ang makakakita ng **"Admin Panel"** button sa app mo — doon mo maa-approve o matatanggihan ang mga bagong sign-up
- Bawat account = sarili at PRIVATE na listahan ng bills — walang ibang user (kahit ikaw bilang admin) ang makakakita ng laman ng bills nila
- Kung may na-input na sila dati sa parehong phone/browser bago sila gumawa ng account, awtomatiko itong ilalagay sa bagong account nila (hindi mawawala)
- **Max 2 devices lang** bawat email/account — kapag sinubukan gamitin sa ika-3 device, hindi na papayagan

### Karagdagang setup na kailangan

1. **I-enable ang Email/Password sign-in** sa Firebase:
   - Sa Firebase Console, punta sa **Build → Authentication**
   - Click "Get Started", piliin **"Email/Password"** sa listahan ng sign-in methods, i-enable, Save

2. **Ilagay ang email mo bilang admin** sa `firebase-config.js`:
   - Buksan ang file, hanapin ang linyang `var ADMIN_EMAIL = "PALITAN_MO_NG_EMAIL_MO@gmail.com";`
   - Palitan ng eksaktong email na gagamitin mong mag-sign-up (ikaw bilang approver)

3. **I-set up ang Database Rules** (para sa privacy at approval logic):
   - Sa Firebase Console, punta sa **Realtime Database → Rules** tab
   - Palitan ang laman ng "Rules" ng ganito (palitan din ang `ADMIN_EMAIL_PLACEHOLDER` ng eksaktong email mo):

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid",
        "devices": {
          "$deviceId": {
            ".write": "auth != null && auth.uid === $uid && (data.exists() || !root.child('users').child($uid).child('devices').hasChildren() || root.child('users').child($uid).child('devices').numChildren() < 2)"
          }
        }
      }
    },
    "pendingApprovals": {
      ".read": "auth != null && auth.token.email === 'ADMIN_EMAIL_PLACEHOLDER'",
      "$uid": {
        ".write": "auth != null && (auth.uid === $uid || auth.token.email === 'ADMIN_EMAIL_PLACEHOLDER')"
      }
    },
    "approvedUsers": {
      "$uid": {
        ".read": "auth != null && (auth.uid === $uid || auth.token.email === 'ADMIN_EMAIL_PLACEHOLDER')",
        ".write": "auth != null && auth.token.email === 'ADMIN_EMAIL_PLACEHOLDER'"
      }
    }
  }
}
```
   - Click "Publish"

4. **I-sign up ka muna bilang admin** sa app gamit ang email na inilagay mo sa `ADMIN_EMAIL` — awtomatiko kang maa-approve, at makikita mo agad ang "Admin Panel" button

5. Pagkatapos, ang sinumang gagawa ng account ay makikita mo sa Admin Panel mo para i-approve

⚠️ Tandaan: ang lumang **"sync code"** na feature ay hindi na ginagamit ngayon — ang login (email + password) na ang gagamitin para sa cross-device access, per-account at private na.
