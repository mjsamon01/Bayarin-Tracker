(function () {
  "use strict";

  var STORAGE_KEY = "bayarin-tracker:bills";
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
    bills: [],
    filter: "all",
    showForm: false,
    formError: "",
  };

  var appEl = document.getElementById("app");
  var deferredInstallPrompt = null;

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredInstallPrompt = e;
    render();
  });

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

  function loadBills() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn("Could not load saved bills", e);
    }
    var seed = seedBills();
    saveBills(seed);
    return seed;
  }

  function saveBills(bills) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bills));
    } catch (e) {
      console.warn("Could not save bills", e);
    }
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

  function render() {
    var bills = state.bills.slice().sort(function (a, b) {
      return new Date(a.dueDate) - new Date(b.dueDate);
    });
    var filtered = state.filter === "all" ? bills : bills.filter(function (b) {
      return getStatus(b) === state.filter;
    });
    var totals = computeTotals(state.bills);

    var html = "";

    html += '<div class="masthead">';
    html += '<div class="eyebrow">Personal Ledger</div>';
    html += "<h1>Bayarin Tracker</h1>";
    html += "<p>Itala ang lahat ng bills mo — due date, bayad, at kulang.</p>";
    html += '<button class="reset-link" id="reset-btn">I-reset ang lahat ng data</button>';
    html += "</div>";

    if (deferredInstallPrompt) {
      html += '<div class="install-banner"><span>I-install ang app na ito sa iyong device para may sariling icon.</span><button id="install-btn">I-install</button></div>';
    }

    html += '<div class="ledger">';

    html += '<div class="summary-row">';
    html += '<div class="summary-cell"><div class="label">Kabuuang Bayarin</div><div class="value">' + peso(totals.due) + "</div></div>";
    html += '<div class="summary-cell paid"><div class="label">Nabayaran Na</div><div class="value">' + peso(totals.paid) + "</div></div>";
    html += '<div class="summary-cell balance"><div class="label">Kulang / Balance</div><div class="value">' + peso(totals.balance) + "</div></div>";
    html += "</div>";

    html += '<div class="toolbar">';
    html += '<div class="filters">';
    [
      ["all", "Lahat"],
      ["overdue", "Lampas (" + totals.overdueCount + ")"],
      ["soon", "Malapit (" + totals.soonCount + ")"],
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

    appEl.innerHTML = html;
    bindEvents();
  }

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
      modal.addEventListener("click", function (e) {
        e.stopPropagation();
      });
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
        state.bills = state.bills.filter(function (b) {
          return b.id !== id;
        });
        saveBills(state.bills);
        render();
      });
    });
  }

  state.bills = loadBills();
  render();
})();
