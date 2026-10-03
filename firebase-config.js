// ============================================================
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyByQ2ph_V7nxikYBc2w102jBWZt5nNe7YY",
  authDomain: "bayarin-tracker.firebaseapp.com",
  databaseURL: "https://bayarin-tracker-default-rtdb.firebaseio.com",
  projectId: "bayarin-tracker",
  storageBucket: "bayarin-tracker.firebasestorage.app",
  messagingSenderId: "805767982695",
  appId: "1:805767982695:web:b9199d678348448ecfeec2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
};

// Ilagay dito ang EMAIL MO (ang approver/admin). Ikaw lang ang makakakita
// ng Admin Panel para mag-approve ng bagong users. Gamitin ang eksaktong
// email na gagamitin mo para mag-sign up.
var ADMIN_EMAIL = "mjsamon01@gmail.com";

// Wag nang galawin ang linya sa baba
if (firebaseConfig.apiKey !== "PALITAN_MO_ITO" && typeof firebase !== "undefined") {
  firebase.initializeApp(firebaseConfig);
}

