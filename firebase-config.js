// ============================================================
// PALITAN ANG MGA VALUES SA IBABA NG SA FIREBASE PROJECT MO
// (makukuha mo ito sa Firebase Console pagkatapos gumawa ng project
// at Realtime Database - tingnan ang README.md para sa buong guide)
// ============================================================
var firebaseConfig = {
  apiKey: "PALITAN_MO_ITO",
  authDomain: "PALITAN_MO_ITO.firebaseapp.com",
  databaseURL: "https://PALITAN_MO_ITO-default-rtdb.firebaseio.com",
  projectId: "PALITAN_MO_ITO",
  storageBucket: "PALITAN_MO_ITO.appspot.com",
  messagingSenderId: "PALITAN_MO_ITO",
  appId: "PALITAN_MO_ITO",
};

// Ilagay dito ang EMAIL MO (ang approver/admin). Ikaw lang ang makakakita
// ng Admin Panel para mag-approve ng bagong users. Gamitin ang eksaktong
// email na gagamitin mo para mag-sign up.
var ADMIN_EMAIL = "PALITAN_MO_NG_EMAIL_MO@gmail.com";

// Wag nang galawin ang linya sa baba
if (firebaseConfig.apiKey !== "PALITAN_MO_ITO" && typeof firebase !== "undefined") {
  firebase.initializeApp(firebaseConfig);
}

