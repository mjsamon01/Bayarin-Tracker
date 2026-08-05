// ============================================================
// PALITAN ANG MGA VALUES SA IBABA NG SA FIREBASE PROJECT MO
// (makukuha mo ito sa Firebase Console pagkatapos gumawa ng project
// at Realtime Database - tingnan ang README.md para sa buong guide)
// ============================================================
var firebaseConfig = {
  apiKey: "AIzaSyByQ2ph_V7nxikYBc2w102jBWZt5nNe7YY",
  authDomain: "bayarin-tracker.firebaseapp.com",
  databaseURL: "https://bayarin-tracker-default-rtdb.firebaseio.com",
  projectId: "bayarin-tracker",
  storageBucket: "bayarin-tracker.firebasestorage.app",
  messagingSenderId: "805767982695",
  appId: "1:805767982695:web:b9199d678348448ecfeec2"
};

// Wag nang galawin ang linya sa baba
if (firebaseConfig.apiKey !== "PALITAN_MO_ITO" && typeof firebase !== "undefined") {
  firebase.initializeApp(firebaseConfig);
}
