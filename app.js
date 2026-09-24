(function () {
  "use strict";

  var STORAGE_KEY = "bayarin-tracker:bills";
  var DEVICE_ID_KEY = "bayarin-tracker:device-id";
  var CATEGORIES = ["Utilities", "Rent", "Internet", "Credit Card", "Subscription", "Loan", "Other"];
  var CATEGORY_COLORS = {
    Utilities: "#8B5E3C",
    Rent: "#3C5A8B",
    Internet: "#5E8B6E",
    "Credit Card": "#8B3C5E",
    Subscription: "#7A5E8B",
    Loan: "#8B7A3C",
    Other: "#5C5C5C",
  };
  var STATUS_META = {
    paid: { label: "BAYAD NA", color: "#4A7A5D", bg: "#EAF2EC" },
    overdue: { label: "LAMPAS NA", color: "#B23A2F", bg: "#FBEAE8" },
    soon: { label: "MALAPIT NA", color: "#B8842A", bg: "#FBF2E1" },
    upcoming: { label: "PARATING", color: "#3C5A8B", bg: "#E9EEF6" },
  };

  var state = {
    // ---- auth ----
    authStatus: "checking", // checking | signedOut | pending | deviceLimit | approved
    authMode: "login", // login | signup
    authError: "",
    isAdmin: false,
    showAdminPanel: false,
    pendingUsers: [],
    currentEmail: "",

    // ---- app/bills ----
    bills: [],
    filter: "all",
    showForm: false,
    formError: "",
  };

  var appEl = document.getElementById("app");
  var deferredInstallPrompt = null;
  var billsRef = null;

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredInstallPrompt = e;
    render();
  });

  // ============================================================
  // Helpers
  // ============================================================
  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function daysUntil(dateStr) {
    var today = new Date(todayISO());
    var due = new Date(dateStr);
    return Math.round((due - today) / (1000 * 60 * 60 * 24));
  }

  function peso(n) {
    return "₱" + Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function getStatus(bill) {
    var balance = bill.amountDue - bill.amountPaid;
    if (balance <= 0) return "paid";
    var d = daysUntil(bill.dueDate);
    if (d < 0) return "overdue";
    if (d <= 7) return "soon";
    return "upcoming";
  }

  function isInCurrentMonth(dateStr) {
    var now = new Date();
    var d = new Date(dateStr);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }

  function monthLabel() {
    var now = new Date();
    var months = ["Enero","Pebrero","Marso","Abril","Mayo","Hunyo","Hulyo","Agosto","Setyembre","Oktubre","Nobyembre","Disyembre"];
    return months[now.getMonth()] + " " + now.getFullYear();
  }

  function seedBills() {
    function plusDays(n) {
      var d = new Date();
      d.setDate(d.getDate() + n);
      return d.toISOString().slice(0, 10);
    }
    return [
      { id: "b1", name: "Meralco", category: "Utilities", dueDate: plusDays(3), amountDue: 2450, amountPaid: 0 },
      { id: "b2", name: "PLDT Fibr", category: "Internet", dueDate: plusDays(-2), amountDue: 1699, amountPaid: 1000 },
      { id: "b3", name: "Rent - Apartment", category: "Rent", dueDate: plusDays(15), amountDue: 8000, amountPaid: 8000 },
    ];
  }

  function esc(str) {
    var div = document.createElement("div");
    div.textContent = String(str);
    return div.innerHTML;
  }

  function computeTotals(bills) {
    var due = 0, paid = 0, overdueCount = 0, soonCount = 0;
    bills.forEach(function (b) {
      due += Number(b.amountDue);
      paid += Number(b.amountPaid);
      var s = getStatus(b);
      if (s === "overdue") overdueCount++;
      if (s === "soon") soonCount++;
    });
    return { due: due, paid: paid, balance: due - paid, overdueCount: overdueCount, soonCount: soonCount };
  }

  function getDeviceId() {
    var id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = "dev-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  }

  function loadLocalBills() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn("Could not load saved bills", e);
    }
    return [];
  }

  function saveLocalBills(bills) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bills));
    } catch (e) {
      console.warn("Could not save bills", e);
    }
  }

  function billsObjectToArray(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val.filter(Boolean);
    return Object.keys(val).map(function (k) { return val[k]; });
  }

  function isCloudAvailable() {
    return typeof firebase !== "undefined" && firebase.apps && firebase.apps.length > 0;
  }

  function friendlyAuthError(code) {
    var map = {
      "auth/email-already-in-use": "May account na gamit ang email na ito. Subukan mag-log in.",
      "auth/invalid-email": "Hindi valid ang email address.",
      "auth/weak-password": "Masyadong simple ang password (dapat 6+ characters).",
      "auth/wrong-password": "Mali ang password.",
      "auth/user-not-found": "Walang account na gamit ang email na ito.",
      "auth/invalid-credential": "Mali ang email o password.",
      "auth/too-many-requests": "Sobrang dami ng attempts. Subukan ulit mamaya.",
    };
    return map[code] || "May naganap na error. Subukan ulit.";
  }

  // ============================================================
  // Bills persistence (per logged-in user)
  // ============================================================
  function saveBills(bills) {
    saveLocalBills(bills);
    if (billsRef) billsRef.set(bills);
  }

  function attachBillsListener(uid) {
    if (billsRef) billsRef.off();
    billsRef = firebase.database().ref("users/" + uid + "/bills");
    billsRef.on("value", function (snapshot) {
      state.bills = billsObjectToArray(snapshot.val());
      saveLocalBills(state.bills);
      render();
    });
  }

  function migrateLocalIfNeeded(uid, cb) {
    var ref = firebase.database().ref("users/" + uid + "/bills");
    ref.once("value").then(function (snap) {
      var cloud = billsObjectToArray(snap.val());
      if (cloud.length === 0) {
        var local = loadLocalBills();
        if (local && local.length > 0) {
          ref.set(local).then(cb).catch(cb);
          return;
        }
      }
      cb();
    }).catch(cb);
  }

  // ============================================================
  // Auth flow
  // ============================================================
  function initAuth() {
    if (!isCloudAvailable()) {
      // Firebase not configured yet: fall back to plain local mode, no login required
      state.authStatus = "approved";
      var local = loadLocalBills();
      if (local.length === 0) {
        local = seedBills();
        saveLocalBills(local);
      }
      state.bills = local;
      render();
      return;
    }

    firebase.auth().onAuthStateChanged(function (user) {
      if (!user) {
        if (billsRef) { billsRef.off(); billsRef = null; }
        state.authStatus = "signedOut";
        state.isAdmin = false;
        state.bills = [];
        render();
        return;
      }
      state.currentEmail = user.email;
      state.isAdmin = !!(window.ADMIN_EMAIL && user.email && user.email.toLowerCase() === window.ADMIN_EMAIL.toLowerCase());
      registerDeviceAndProceed(user);
    });
  }

  function registerDeviceAndProceed(user) {
    var uid = user.uid;
    var deviceId = getDeviceId();
    var devRef = firebase.database().ref("users/" + uid + "/devices/" + deviceId);
    devRef.set(true).then(function () {
      proceedAfterDevice(user);
    }).catch(function () {
      state.authStatus = "deviceLimit";
      render();
      firebase.auth().signOut();
    });
  }

  function proceedAfterDevice(user) {
    var uid = user.uid;

    function afterApprovalCheck(approved) {
      if (approved || state.isAdmin) {
        if (state.isAdmin) {
          firebase.database().ref("approvedUsers/" + uid).set(true);
          firebase.database().ref("pendingApprovals/" + uid).remove();
        }
        migrateLocalIfNeeded(uid, function () {
          state.authStatus = "approved";
          attachBillsListener(uid);
          render();
        });
      } else {
        firebase.database().ref("pendingApprovals/" + uid).set({ email: user.email, requestedAt: Date.now() });
        state.authStatus = "pending";
        render();
      }
    }

    firebase.database().ref("approvedUsers/" + uid).once("value").then(function (snap) {
      afterApprovalCheck(snap.val() === true);
    }).catch(function () {
      afterApprovalCheck(false);
    });
  }

  function loadAdminPending() {
    firebase.database().ref("pendingApprovals").once("value").then(function (snap) {
      var val = snap.val() || {};
      state.pendingUsers = Object.keys(val).map(function (uid) {
        return { uid: uid, email: val[uid] && val[uid].email };
      });
      render();
    }).catch(function () {
      state.pendingUsers = [];
      render();
    });
  }

  function approveUser(uid) {
    firebase.database().ref("approvedUsers/" + uid).set(true).then(function () {
      firebase.database().ref("pendingApprovals/" + uid).remove();
      loadAdminPending();
    });
  }

  function rejectUser(uid) {
    firebase.database().ref("pendingApprovals/" + uid).remove().then(loadAdminPending);
  }

  // ============================================================
  // Render: top-level router
  // ============================================================
  function render() {
    if (state.authStatus === "checking") return renderChecking();
    if (state.authStatus === "signedOut") return renderAuthScreen();
    if (state.authStatus === "pending") return renderPending();
    if (state.authStatus === "deviceLimit") return renderDeviceLimit();
    return renderApp();
  }

  function shellOpen(narrow) {
    return '<div class="app' + (narrow ? " app--loading" : "") + '">';
  }

  function logoBlock() {
    return '<div class="masthead"><div class="eyebrow">Personal Ledger</div><h1>Bayarin Tracker</h1></div>';
  }

  function renderChecking() {
    appEl.innerHTML =
      '<div class="app app--loading"><div class="loading-box"><div class="spin"></div>Sinusuri ang account...</div></div>';
  }

  function renderAuthScreen() {
    var isSignup = state.authMode === "signup";
    var html = '<div class="app app--loading"><div class="auth-card">';
    html += '<div class="auth-logo"><img src="icons/logo-wide.png" alt="Bayarin Tracker" class="auth-logo-img" /></div>';
    html += '<div class="auth-tabs">';
    html += '<button class="auth-tab' + (!isSignup ? " active" : "") + '" data-authmode="login">Mag-log in</button>';
    html += '<button class="auth-tab' + (isSignup ? " active" : "") + '" data-authmode="signup">Gumawa ng Account</button>';
    html += "</div>";
    html += '<form id="auth-form">';
    html += '<div class="form-group"><label>Email</label><input type="email" id="auth-email" placeholder="you@email.com" required /></div>';
    html += '<div class="form-group"><label>Password</label><input type="password" id="auth-password" placeholder="••••••••" required /></div>';
    if (isSignup) {
      html += '<div class="form-group"><label>Ulitin ang Password</label><input type="password" id="auth-password2" placeholder="••••••••" required /></div>';
    }
    if (state.authError) {
      html += '<div class="error-msg">' + esc(state.authError) + "</div>";
    }
    html += '<button type="submit" class="submit-btn">' + (isSignup ? "Gumawa ng Account" : "Mag-log in") + "</button>";
    html += "</form>";
    if (isSignup) {
      html += '<p class="auth-note">Pagkatapos gumawa ng account, kailangan pa itong aprubahan bago ka makapasok.</p>';
    }
    html += "</div></div>";
    appEl.innerHTML = html;
    bindAuthEvents();
  }

  function renderPending() {
    var html = '<div class="app app--loading"><div class="auth-card">';
    html += '<div class="auth-logo"><img src="icons/logo-wide.png" alt="Bayarin Tracker" class="auth-logo-img" /></div>';
    html += '<div class="pending-icon">⏳</div>';
    html += "<h2 class=\"pending-title\">Naghihintay ng Approval</h2>";
    html += '<p class="auth-note">Naka-sign up ka na bilang <strong>' + esc(state.currentEmail) + '</strong>.<br/>Aaprubahan muna ito bago ka makapasok. Balikan mo na lang ang page na ito paminsan-minsan.</p>';
    html += '<button class="reset-link" id="logout-btn" style="margin-top:14px">Mag-logout</button>';
    html += "</div></div>";
    appEl.innerHTML = html;
    var logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) logoutBtn.addEventListener("click", function () { firebase.auth().signOut(); });
  }

  function renderDeviceLimit() {
    var html = '<div class="app app--loading"><div class="auth-card">';
    html += '<div class="auth-logo"><img src="icons/logo-wide.png" alt="Bayarin Tracker" class="auth-logo-img" /></div>';
    html += '<div class="pending-icon">🚫</div>';
    html += "<h2 class=\"pending-title\">Naabot na ang Limit ng Device</h2>";
    html += '<p class="auth-note">Dalawang (2) device na lang ang pwedeng gamitin bawat account. Gumamit ng dati mo nang na-login na device, o makipag-ugnayan sa approver kung kailangan mo ng dagdag.</p>';
    html += '<button type="button" class="submit-btn" id="back-to-login-btn">Balik sa Login</button>';
    html += "</div></div>";
    appEl.innerHTML = html;
    var backBtn = document.getElementById("back-to-login-btn");
    if (backBtn) backBtn.addEventListener("click", function () { state.authStatus = "signedOut"; render(); });
  }

  // ============================================================
  // Main app (ledger) render
  // ============================================================
  function renderApp() {
    var bills = state.bills.slice().sort(function (a, b) {
      return new Date(a.dueDate) - new Date(b.dueDate);
    });
    var filtered = state.filter === "all" ? bills
      : state.filter === "month" ? bills.filter(function (b) { return isInCurrentMonth(b.dueDate); })
      : bills.filter(function (b) { return getStatus(b) === state.filter; });
    var totalsAll = computeTotals(state.bills);
    var totals = state.filter === "month" ? computeTotals(filtered) : totalsAll;
    var summaryLabelSuffix = state.filter === "month" ? " (" + monthLabel() + ")" : "";

    var html = "";

    html += '<div class="masthead">';
    html += '<img src="icons/logo-wide-light.png" alt="Bayarin Tracker" class="masthead-logo" />';
    if (isCloudAvailable()) {
      html += "<p>" + esc(state.currentEmail) + "</p>";
    } else {
      html += "<p>Itala ang lahat ng bills mo — due date, bayad, at kulang.</p>";
    }
    html += '<div style="display:flex;gap:14px;justify-content:center;margin-top:6px;flex-wrap:wrap">';
    html += '<button class="reset-link" id="reset-btn">I-reset ang lahat ng data</button>';
    if (isCloudAvailable()) {
      html += '<button class="reset-link" id="logout-btn">Mag-logout</button>';
      if (state.isAdmin) {
        html += '<button class="reset-link" id="admin-btn">Admin Panel</button>';
      }
    }
    html += "</div></div>";

    if (deferredInstallPrompt) {
      html += '<div class="install-banner"><span>I-install ang app na ito sa iyong device para may sariling icon.</span><button id="install-btn">I-install</button></div>';
    }

    html += '<div class="ledger">';

    html += '<div class="summary-row">';
    html += '<div class="summary-cell"><div class="label">Kabuuang Bayarin' + esc(summaryLabelSuffix) + '</div><div class="value">' + peso(totals.due) + "</div></div>";
    html += '<div class="summary-cell paid"><div class="label">Nabayaran Na' + esc(summaryLabelSuffix) + '</div><div class="value">' + peso(totals.paid) + "</div></div>";
    html += '<div class="summary-cell balance"><div class="label">Kulang / Balance' + esc(summaryLabelSuffix) + '</div><div class="value">' + peso(totals.balance) + "</div></div>";
    html += "</div>";

    html += '<div class="toolbar">';
    html += '<div class="filters">';
    [
      ["all", "Lahat"],
      ["month", "Ngayong Buwan"],
      ["overdue", "Lampas (" + totalsAll.overdueCount + ")"],
      ["soon", "Malapit (" + totalsAll.soonCount + ")"],
      ["paid", "Bayad na"],
    ].forEach(function (f) {
      var active = state.filter === f[0] ? " active" : "";
      html += '<button class="filter-btn' + active + '" data-filter="' + f[0] + '">' + f[1] + "</button>";
    });
    html += "</div>";
    html += '<button class="add-btn" id="add-btn">+ Magdagdag ng Bill</button>';
    html += "</div>";

    html += '<div class="entries">';
    if (filtered.length === 0) {
      html += '<div class="empty-state">Walang bill dito. I-click ang "Magdagdag ng Bill" para magsimula.</div>';
    } else {
      filtered.forEach(function (bill) {
        var status = getStatus(bill);
        var meta = STATUS_META[status];
        var balance = bill.amountDue - bill.amountPaid;
        var d = daysUntil(bill.dueDate);
        var dueLabel;
        if (status === "paid") dueLabel = "Due: " + bill.dueDate;
        else if (d < 0) dueLabel = "Due: " + bill.dueDate + " · " + Math.abs(d) + " araw nang lumampas";
        else if (d === 0) dueLabel = "Due: " + bill.dueDate + " · NGAYON";
        else dueLabel = "Due: " + bill.dueDate + " · " + d + " araw na lang";

        html += '<div class="entry">';
        html += '<div class="entry-main">';
        html += '<div class="entry-top">';
        html += '<span class="entry-name">' + esc(bill.name) + "</span>";
        html += '<span class="cat-tag" style="background:' + CATEGORY_COLORS[bill.category] + '">' + esc(bill.category) + "</span>";
        html += '<span class="stamp-badge" style="color:' + meta.color + ";border-color:" + meta.color + ";background:" + meta.bg + '">' + meta.label + "</span>";
        html += "</div>";
        html += '<div class="entry-meta">' + esc(dueLabel) + "</div>";
        html += '<div class="amounts">';
        html += '<div class="amt-field"><label>Dapat Bayaran</label><div class="static-val">' + peso(bill.amountDue) + "</div></div>";
        html += '<div class="amt-field"><label>Nabayaran</label><input type="number" class="paid-input" min="0" step="0.01" value="' + bill.amountPaid + '" data-paid-id="' + bill.id + '" /></div>';
        html += '<div class="amt-field"><label>Kulang</label><div class="balance-val" style="color:' + (balance > 0 ? "#B23A2F" : "#4A7A5D") + '">' + peso(Math.max(balance, 0)) + "</div></div>";
        html += "</div></div>";
        html += '<div class="entry-actions">';
        if (status !== "paid") {
          html += '<button class="icon-btn" data-mark-paid="' + bill.id + '">✓ Bayad na</button>';
        }
        html += '<button class="icon-btn danger" data-delete="' + bill.id + '">🗑 Alisin</button>';
        html += "</div></div>";
      });
    }
    html += "</div></div>";

    if (state.showForm) {
      html += '<div class="modal-backdrop" id="modal-backdrop">';
      html += '<div class="modal" id="modal">';
      html += '<div class="modal-header"><h2>Bagong Bill</h2><button class="close-btn" id="close-modal">×</button></div>';
      html += '<form id="bill-form">';
      html += '<div class="form-group"><label>Pangalan ng Bill</label><input type="text" id="f-name" placeholder="hal. Meralco, Globe, Rent" /></div>';
      html += '<div class="form-group"><label>Kategorya</label><select id="f-category">';
      CATEGORIES.forEach(function (c) {
        html += '<option value="' + c + '">' + c + "</option>";
      });
      html += "</select></div>";
      html += '<div class="form-group"><label>Due Date</label><input type="date" id="f-duedate" value="' + todayISO() + '" /></div>';
      html += '<div class="form-row">';
      html += '<div class="form-group"><label>Dapat Bayaran</label><input type="number" id="f-amountdue" min="0" step="0.01" placeholder="0.00" /></div>';
      html += '<div class="form-group"><label>Nabayaran Na (kung meron)</label><input type="number" id="f-amountpaid" min="0" step="0.01" placeholder="0.00" /></div>';
      html += "</div>";
      if (state.formError) {
        html += '<div class="error-msg">' + esc(state.formError) + "</div>";
      }
      html += '<button type="submit" class="submit-btn">Idagdag sa Ledger</button>';
      html += "</form></div></div>";
    }

    if (state.showAdminPanel) {
      html += '<div class="modal-backdrop" id="admin-modal-backdrop">';
      html += '<div class="modal" id="admin-modal">';
      html += '<div class="modal-header"><h2>Admin Panel</h2><button class="close-btn" id="close-admin-modal">×</button></div>';
      if (state.pendingUsers.length === 0) {
        html += '<p style="font-size:13px;color:#6b6455">Walang naghihintay na approval ngayon.</p>';
      } else {
        html += '<div class="admin-list">';
        state.pendingUsers.forEach(function (u) {
          html += '<div class="admin-row">';
          html += '<span class="admin-email">' + esc(u.email || u.uid) + "</span>";
          html += '<div class="admin-actions">';
          html += '<button class="icon-btn" data-approve="' + esc(u.uid) + '">✓ Aprubahan</button>';
          html += '<button class="icon-btn danger" data-reject="' + esc(u.uid) + '">✕ Tanggihan</button>';
          html += "</div></div>";
        });
        html += "</div>";
      }
      html += "</div></div>";
    }

    appEl.innerHTML = html;
    bindEvents();
  }

  // ============================================================
  // Event bindings: auth screens
  // ============================================================
  function bindAuthEvents() {
    document.querySelectorAll("[data-authmode]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.authMode = btn.getAttribute("data-authmode");
        state.authError = "";
        render();
      });
    });

    var form = document.getElementById("auth-form");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var email = document.getElementById("auth-email").value.trim();
        var password = document.getElementById("auth-password").value;
        state.authError = "";

        if (state.authMode === "signup") {
          var password2 = document.getElementById("auth-password2").value;
          if (password !== password2) {
            state.authError = "Hindi magkatugma ang password.";
            render();
            return;
          }
          firebase.auth().createUserWithEmailAndPassword(email, password).catch(function (err) {
            state.authError = friendlyAuthError(err.code);
            render();
          });
        } else {
          firebase.auth().signInWithEmailAndPassword(email, password).catch(function (err) {
            state.authError = friendlyAuthError(err.code);
            render();
          });
        }
      });
    }
  }

  // ============================================================
  // Event bindings: main app
  // ============================================================
  function bindEvents() {
    var resetBtn = document.getElementById("reset-btn");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        if (!confirm("Sigurado ka bang gusto mong burahin lahat ng naka-save na bills?")) return;
        state.bills = [];
        saveBills(state.bills);
        render();
      });
    }

    var logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", function () {
        firebase.auth().signOut();
      });
    }

    var adminBtn = document.getElementById("admin-btn");
    if (adminBtn) {
      adminBtn.addEventListener("click", function () {
        state.showAdminPanel = true;
        render();
        loadAdminPending();
      });
    }

    var closeAdminModal = document.getElementById("close-admin-modal");
    if (closeAdminModal) {
      closeAdminModal.addEventListener("click", function () {
        state.showAdminPanel = false;
        render();
      });
    }
    var adminBackdrop = document.getElementById("admin-modal-backdrop");
    if (adminBackdrop) {
      adminBackdrop.addEventListener("click", function (e) {
        if (e.target === adminBackdrop) {
          state.showAdminPanel = false;
          render();
        }
      });
    }
    var adminModal = document.getElementById("admin-modal");
    if (adminModal) {
      adminModal.addEventListener("click", function (e) { e.stopPropagation(); });
    }
    document.querySelectorAll("[data-approve]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        approveUser(btn.getAttribute("data-approve"));
      });
    });
    document.querySelectorAll("[data-reject]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        rejectUser(btn.getAttribute("data-reject"));
      });
    });

    var installBtn = document.getElementById("install-btn");
    if (installBtn) {
      installBtn.addEventListener("click", function () {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        deferredInstallPrompt.userChoice.finally(function () {
          deferredInstallPrompt = null;
          render();
        });
      });
    }

    document.querySelectorAll(".filter-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.filter = btn.getAttribute("data-filter");
        render();
      });
    });

    var addBtn = document.getElementById("add-btn");
    if (addBtn) {
      addBtn.addEventListener("click", function () {
        state.showForm = true;
        state.formError = "";
        render();
      });
    }

    var closeModal = document.getElementById("close-modal");
    if (closeModal) {
      closeModal.addEventListener("click", function () {
        state.showForm = false;
        render();
      });
    }

    var backdrop = document.getElementById("modal-backdrop");
    if (backdrop) {
      backdrop.addEventListener("click", function (e) {
        if (e.target === backdrop) {
          state.showForm = false;
          render();
        }
      });
    }
    var modal = document.getElementById("modal");
    if (modal) {
      modal.addEventListener("click", function (e) { e.stopPropagation(); });
    }

    var form = document.getElementById("bill-form");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var name = document.getElementById("f-name").value.trim();
        var category = document.getElementById("f-category").value;
        var dueDate = document.getElementById("f-duedate").value;
        var amountDue = document.getElementById("f-amountdue").value;
        var amountPaid = document.getElementById("f-amountpaid").value;

        if (!name) {
          state.formError = "Kailangan ng pangalan ng bill.";
          render();
          return;
        }
        if (!dueDate) {
          state.formError = "Kailangan ng due date.";
          render();
          return;
        }
        if (amountDue === "" || Number(amountDue) < 0) {
          state.formError = "Ilagay ang tamang halaga na dapat bayaran.";
          render();
          return;
        }

        state.bills.push({
          id: "bill-" + Date.now(),
          name: name,
          category: category,
          dueDate: dueDate,
          amountDue: Number(amountDue),
          amountPaid: Number(amountPaid || 0),
        });
        saveBills(state.bills);
        state.showForm = false;
        state.formError = "";
        render();
      });
    }

    document.querySelectorAll("[data-paid-id]").forEach(function (input) {
      input.addEventListener("change", function () {
        var id = input.getAttribute("data-paid-id");
        var val = Math.max(0, Number(input.value) || 0);
        state.bills = state.bills.map(function (b) {
          return b.id === id ? Object.assign({}, b, { amountPaid: val }) : b;
        });
        saveBills(state.bills);
        render();
      });
    });

    document.querySelectorAll("[data-mark-paid]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-mark-paid");
        state.bills = state.bills.map(function (b) {
          return b.id === id ? Object.assign({}, b, { amountPaid: b.amountDue }) : b;
        });
        saveBills(state.bills);
        render();
      });
    });

    document.querySelectorAll("[data-delete]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-delete");
        state.bills = state.bills.filter(function (b) { return b.id !== id; });
        saveBills(state.bills);
        render();
      });
    });
  }

  initAuth();
})();
