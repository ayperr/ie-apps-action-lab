/* Real action starter: same-origin server routes deliver synthetic events to
 * a personal ntfy.sh receiver and verify the captured request.
 * Practice mode remains a separate local simulator. No API secrets are used.
 */
(() => {
  "use strict";

  const STORAGE_KEY = "northstar-action-lab:v1:history";
  const MAX_HISTORY = 150;
  const RECEIVER_KEY = "northstar-action-lab:v1:receiver";
  const CAPTURE_ID = /^[A-Za-z0-9_-]{1,64}$/;
  const UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const viewerUrl = (id) => `https://ntfy.sh/ie-action-lab-${id}`;
  const REAL_RESULTS = {
    received: {
      label: "Receipt verified",
      icon: "✓",
      detail:
        "ntfy.sh captured this real event. Open the test inbox and match the request ID to inspect the delivered payload.",
    },
    accepted: {
      label: "Send accepted",
      icon: "↗︎",
      detail:
        "The service accepted the HTTP request, but its captured receipt is not verified yet. Check the receipt before sending anything again.",
    },
    unknown: {
      label: "Receipt unknown",
      icon: "?",
      detail:
        "The app could not confirm the external outcome. The event may already exist. Verify its receipt before considering another send.",
    },
    rejected: {
      label: "Send rejected",
      icon: "×",
      detail:
        "The service rejected the event. Review the error and inbox availability; this is not a verified delivery.",
    },
    sending: {
      label: "Sending real event",
      icon: "…",
      detail:
        "Sending the confirmed synthetic event to your test inbox, then checking its receipt.",
    },
  };
  const SIGNALS = {
    negative: { label: "Negative contribution", short: "Negative margin" },
    late: { label: "Late delivery", short: "Late delivery" },
    refund: { label: "High refund", short: "High refund" },
  };
  const RESULTS = {
    success: {
      label: "Simulated success",
      icon: "✓",
      detail:
        "This local simulation accepted the request. No external event was sent. Switch to Live test to send and verify a real ntfy.sh event.",
    },
    rejected: {
      label: "Simulated rejection",
      icon: "×",
      detail:
        "This local simulation represents a rejected request. No external event was sent. Real failures must stay separate from verified deliveries.",
    },
    uncertain: {
      label: "Simulated unknown result",
      icon: "?",
      detail:
        "The rehearsal lost the response after a request was sent. In a live integration, the external action may already exist. Check the destination before retrying to avoid a duplicate. This practice did not send anything.",
    },
    processing: {
      label: "Practice in progress",
      icon: "…",
      detail:
        "Rehearsing the request locally. No external service is being contacted.",
    },
  };
  const $ = (selector) => document.querySelector(selector);
  const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  const exactMoney = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
  const state = {
    orders: [],
    asOf: "2026-11-17",
    selectedId: null,
    filters: { search: "", signal: "all", status: "all" },
    history: [],
    submitting: false,
    storageAvailable: true,
    dialogOrderId: null,
    mode: "real",
    receiver: null,
    connecting: false,
    verifying: new Set(),
  };
  let toastTimer;

  // Build nodes with textContent; user-edited requests are never interpreted as HTML.
  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function dateLabel(iso) {
    return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  function describeStatus(status) {
    return (
      {
        delivered: "Delivered",
        in_transit: "In transit",
        processing: "Processing",
      }[status] || status
    );
  }
  function net(order) {
    return order.revenue - order.refund;
  }
  function profit(order) {
    return net(order) - order.cost;
  }
  function margin(order) {
    return net(order) === 0 ? null : profit(order) / net(order);
  }
  function signals(order) {
    const list = [];
    if (profit(order) < 0) list.push("negative");
    if ((order.deliveredDate || state.asOf) > order.promisedDate)
      list.push("late");
    if (order.revenue > 0 && order.refund / order.revenue >= 0.25)
      list.push("refund");
    return list;
  }
  function visibleOrders() {
    return state.orders.filter((order) => {
      const search = [
        order.id,
        order.product,
        order.category,
        order.region,
        order.channel,
        order.owner,
      ]
        .join(" ")
        .toLowerCase();
      const flags = signals(order);
      const signalMatch =
        state.filters.signal === "all" ||
        (state.filters.signal === "attention" && flags.length > 0) ||
        (state.filters.signal === "clear" && flags.length === 0) ||
        flags.includes(state.filters.signal);
      return (
        search.includes(state.filters.search.toLowerCase()) &&
        signalMatch &&
        (state.filters.status === "all" ||
          order.status === state.filters.status)
      );
    });
  }
  function statusBadge(signal) {
    return node(
      "span",
      `signal-badge ${signal || ""}`,
      signal ? SIGNALS[signal].short : "No signals",
    );
  }
  function notify(message) {
    clearTimeout(toastTimer);
    $("#toast").textContent = message;
    $("#toast").hidden = false;
    toastTimer = setTimeout(() => {
      $("#toast").hidden = true;
    }, 6000);
  }
  function setStorageWarning(message) {
    const warning = $("#storage-warning");
    warning.textContent = message;
    warning.hidden = !message;
  }
  function readHistory() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (!Array.isArray(saved)) throw new Error("Invalid history");
      const valid = saved.filter(
        (entry) =>
          entry &&
          typeof entry.id === "string" &&
          typeof entry.orderId === "string" &&
          typeof entry.title === "string" &&
          typeof entry.reason === "string" &&
          typeof entry.destination === "string" &&
          typeof entry.createdAt === "string" &&
          !Number.isNaN(Date.parse(entry.createdAt)) &&
          ((entry.mode === "practice" &&
            Object.hasOwn(RESULTS, entry.status)) ||
            (entry.mode === "real" &&
              Object.hasOwn(REAL_RESULTS, entry.status) &&
              UUID.test(entry.id) &&
              UUID.test(entry.receiverId))),
      );
      state.history = valid.slice(0, MAX_HISTORY).map((entry) => ({
        ...entry,
        status:
          entry.status === "processing"
            ? "uncertain"
            : entry.status === "sending"
              ? "unknown"
              : entry.status,
      }));
      // A reload interrupts a rehearsal; never silently convert it to success.
      if (
        valid.some((entry) => ["processing", "sending"].includes(entry.status))
      ) {
        saveHistory();
        notify(
          "An interrupted action has an unknown result. Verify any real receipt before sending again.",
        );
      }
    } catch {
      state.history = [];
      state.storageAvailable = false;
      setStorageWarning(
        "Browser storage is unavailable or the saved history could not be read. New practice requests will remain in memory only; export them before closing this page.",
      );
    }
  }
  function saveHistory() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state.history.slice(0, MAX_HISTORY)),
      );
      state.storageAvailable = true;
      setStorageWarning("");
    } catch {
      state.storageAvailable = false;
      setStorageWarning(
        "This browser could not save the latest request. It remains in memory for this visit; export the JSON before closing or reloading.",
      );
    }
  }

  function renderMetrics(orders) {
    $("#metric-revenue").textContent = money.format(
      orders.reduce((sum, order) => sum + net(order), 0),
    );
    $("#metric-profit").textContent = money.format(
      orders.reduce((sum, order) => sum + profit(order), 0),
    );
    $("#metric-orders").textContent = String(orders.length).padStart(2, "0");
    $("#metric-attention").textContent = String(
      orders.filter((order) => signals(order).length).length,
    ).padStart(2, "0");
    $("#metric-order-note").textContent =
      orders.length === state.orders.length
        ? "All channels and regions"
        : `${state.orders.length} total · current filters applied`;
  }
  function renderCharts(orders) {
    const regions = [
      ...new Set(state.orders.map((order) => order.region)),
    ].sort();
    const totals = regions.map((region) => ({
      region,
      total: orders
        .filter((order) => order.region === region)
        .reduce((sum, order) => sum + net(order), 0),
    }));
    const max = Math.max(1, ...totals.map((item) => item.total));
    $("#region-chart").replaceChildren(
      ...totals.map(({ region, total }) => {
        const row = node("div", "region-row");
        row.setAttribute("role", "listitem");
        const track = node("div", "bar-track");
        track.setAttribute("aria-hidden", "true");
        const fill = node("div", "bar-fill");
        fill.style.width = `${Math.max(0, (total / max) * 100)}%`;
        track.append(fill);
        row.append(
          node("span", "region-label", region),
          track,
          node("span", "region-value", money.format(total)),
        );
        return row;
      }),
    );
    // Signal totals are based on the same filters as the revenue chart and KPIs.
    $("#signal-chart").replaceChildren(
      ...Object.entries(SIGNALS).map(([key, signal]) => {
        const button = node("button", `signal-tile ${key}`);
        button.type = "button";
        button.setAttribute(
          "aria-pressed",
          String(state.filters.signal === key),
        );
        const count = orders.filter((order) =>
          signals(order).includes(key),
        ).length;
        button.setAttribute(
          "aria-label",
          `${signal.label}: ${count} orders in current view. Filter by this signal.`,
        );
        button.append(
          node("span", "", signal.label),
          node("strong", "", String(count).padStart(2, "0")),
        );
        button.addEventListener("click", () => {
          state.filters.signal = state.filters.signal === key ? "all" : key;
          $("#signal-filter").value = state.filters.signal;
          renderWorkspace();
          $(`#signal-chart .signal-tile.${key}`).focus({ preventScroll: true });
        });
        return button;
      }),
    );
  }
  function renderOrders(orders) {
    $("#order-count").textContent =
      `${orders.length} ${orders.length === 1 ? "order" : "orders"}`;
    $("#empty-orders").hidden = orders.length > 0;
    $("#orders-body").replaceChildren(
      ...orders.map((order) => {
        const flags = signals(order);
        const row = node("tr");
        row.dataset.orderId = order.id;
        row.dataset.selected = String(state.selectedId === order.id);
        const identity = node("td");
        const button = node("button", "order-link", order.id);
        button.type = "button";
        button.setAttribute(
          "aria-label",
          `Inspect order ${order.id}, ${order.product}`,
        );
        button.setAttribute(
          "aria-pressed",
          String(state.selectedId === order.id),
        );
        button.addEventListener("click", () => selectOrder(order.id));
        identity.append(button, node("span", "product-name", order.product));
        const marginValue = margin(order);
        const marginCell = node(
          "td",
          `money-cell ${profit(order) < 0 ? "margin-negative" : ""}`,
          marginValue === null ? "—" : `${(marginValue * 100).toFixed(1)}%`,
        );
        const signalCell = node("td");
        signalCell.append(statusBadge(flags[0]));
        if (flags.length > 1)
          signalCell.append(
            node("span", "signal-extra", `+${flags.length - 1}`),
          );
        row.append(
          identity,
          node("td", "money-cell", money.format(net(order))),
          marginCell,
          signalCell,
          node("td", "table-arrow", "↗︎"),
        );
        row.addEventListener("click", (event) => {
          if (!event.target.closest("button")) selectOrder(order.id);
        });
        return row;
      }),
    );
  }
  function selectOrder(id) {
    state.selectedId = id;
    // Keep the clicked button mounted so keyboard focus remains on the selection.
    document
      .querySelectorAll("#orders-body tr[data-order-id]")
      .forEach((row) => {
        const selected = row.dataset.orderId === id;
        row.dataset.selected = String(selected);
        row
          .querySelector("button")
          .setAttribute("aria-pressed", String(selected));
      });
    renderDetail();
  }
  function renderDetail() {
    const detail = $("#order-detail");
    const order = state.orders.find((item) => item.id === state.selectedId);
    detail.replaceChildren();
    if (!order) {
      const empty = node("div", "empty-state");
      empty.append(
        node("h3", "", "No order selected"),
        node(
          "p",
          "",
          "Choose an order from the current results to review its context.",
        ),
      );
      detail.append(empty);
      return;
    }
    const top = node("div", "detail-top");
    top.append(
      node("span", "detail-kicker", "Selected order"),
      node("span", "detail-status", describeStatus(order.status)),
    );
    const flagList = node("div", "detail-flags");
    const flags = signals(order);
    (flags.length ? flags : [null]).forEach((signal) =>
      flagList.append(statusBadge(signal)),
    );
    const values = [
      ["Net sales", exactMoney.format(net(order))],
      ["Product cost", exactMoney.format(order.cost)],
      ["Contribution", exactMoney.format(profit(order))],
      ["Refund", exactMoney.format(order.refund)],
      ["Region / channel", `${order.region} / ${order.channel}`],
      ["Responsible team", order.owner],
    ];
    const context = node("dl", "detail-context");
    values.forEach(([label, value]) => {
      const item = node("div");
      item.append(node("dt", "", label), node("dd", "", value));
      context.append(item);
    });
    const delivery = order.deliveredDate
      ? `Delivered ${dateLabel(order.deliveredDate)}.`
      : `Not delivered as of ${dateLabel(state.asOf)}.`;
    const description = node(
      "p",
      "detail-summary",
      `Ordered ${dateLabel(order.orderDate)}. Promised ${dateLabel(order.promisedDate)}. ${delivery}`,
    );
    const note = node("div", "detail-note");
    note.append(
      node("strong", "", "Operational context"),
      document.createTextNode(order.note),
    );
    const action = node("button", "button primary", "Request a review");
    action.type = "button";
    action.append(node("span", "", "→"));
    action.addEventListener("click", openReview);
    detail.append(
      top,
      node("h2", "", order.id),
      node(
        "p",
        "detail-product",
        `${order.product} · ${order.quantity} ${order.quantity === 1 ? "unit" : "units"}`,
      ),
      flagList,
      context,
      description,
      note,
      action,
      node(
        "p",
        "detail-footnote",
        state.mode === "real"
          ? "Review first. Confirm to send one real event."
          : "Review first. Confirm second. Practice only.",
      ),
    );
  }
  function renderWorkspace() {
    const orders = visibleOrders();
    if (!orders.some((order) => order.id === state.selectedId))
      state.selectedId = orders[0]?.id || null;
    renderMetrics(orders);
    renderCharts(orders);
    renderOrders(orders);
    renderDetail();
  }
  function renderHistory() {
    $("#nav-count").textContent = String(state.history.length);
    $("#export-history").disabled = !state.history.length;
    $("#reset-history").disabled = !state.history.length || state.submitting;
    const list = $("#history-list");
    if (!state.history.length) {
      const empty = node("div", "history-empty");
      const icon = node("span", "empty-icon", "↗︎");
      icon.setAttribute("aria-hidden", "true");
      const copy = node("div");
      copy.append(
        node("h3", "", "Your first action starts with a record."),
        node(
          "p",
          "",
          "Connect your test inbox, select an order and review an action before sending.",
        ),
      );
      empty.append(icon, copy);
      list.replaceChildren(empty);
      return;
    }
    list.replaceChildren(
      ...state.history.map((entry) => {
        const baseResult = (entry.mode === "real" ? REAL_RESULTS : RESULTS)[
          entry.status
        ];
        const duplicate =
          entry.mode === "real" &&
          entry.warning === "DUPLICATE_CAPTURES" &&
          entry.captureCount > 1;
        const result = duplicate
          ? { ...baseResult, label: "Receipt verified · duplicates", icon: "!" }
          : baseResult;
        const row = node("article", "activity-row");
        const icon = node(
          "span",
          `activity-icon ${duplicate ? "unknown" : entry.status}`,
          result.icon,
        );
        icon.setAttribute("aria-hidden", "true");
        const copy = node("div");
        copy.append(
          node("h3", "activity-title", entry.title),
          node(
            "p",
            "activity-meta",
            `${entry.mode === "real" ? "LIVE EVENT" : "LOCAL PRACTICE"} · ${entry.orderId} → ${entry.destination}`,
          ),
          node("p", "activity-description", result.detail),
          ...(entry.message ? [node("p", "activity-meta", entry.message)] : []),
        );
        const request = node("details", "activity-request");
        request.append(
          node("summary", "", "View the saved request"),
          node("p", "", entry.reason),
          node(
            "p",
            "activity-ref",
            `${entry.mode === "real" ? "Request ID" : "Local request"} ${entry.id}`,
          ),
        );
        copy.append(request);
        if (duplicate)
          copy.append(
            node(
              "p",
              "duplicate-warning",
              `Duplicate delivery detected: ${entry.captureCount} captured events share this request ID. Do not resend; investigate the duplicate captures.`,
            ),
          );
        if (entry.mode === "real") {
          const links = node("div", "receipt-links");
          const inbox = node("a", "text-link", "Open test inbox ↗︎");
          inbox.href = viewerUrl(entry.receiverId);
          inbox.target = "_blank";
          inbox.rel = "noopener noreferrer";
          links.append(inbox);
          if (["received", "accepted", "unknown"].includes(entry.status)) {
            const verify = node(
              "button",
              "button secondary small",
              state.verifying.has(entry.id) ? "Checking…" : "Verify receipt",
            );
            verify.type = "button";
            verify.disabled = state.verifying.has(entry.id);
            verify.addEventListener("click", () => verifyReceipt(entry));
            links.append(verify);
          }
          copy.append(links);
          if (entry.captureId)
            copy.append(
              node("p", "activity-ref", `Captured request: ${entry.captureId}`),
            );
        }
        const outcome = node(
          "div",
          `activity-result ${duplicate ? "unknown" : entry.status}`,
          result.label,
        );
        const time = node(
          "time",
          "",
          new Date(entry.createdAt).toLocaleString("en-GB", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          }),
        );
        time.dateTime = entry.createdAt;
        outcome.append(time);
        row.append(icon, copy, outcome);
        return row;
      }),
    );
  }
  async function apiJson(path, payload) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error(
          response.status === 404
            ? "Live API routes are missing on this host. Deploy or open the standalone app to use live delivery."
            : "The server did not return a readable result. Verify the receipt before sending again.",
        );
      }
      if (!data || typeof data !== "object")
        throw new Error("The server returned an unreadable result.");
      return { ...data, responseStatus: response.status };
    } finally {
      clearTimeout(timeout);
    }
  }
  function errorMessage(data, fallback) {
    return typeof data.message === "string"
      ? data.message.slice(0, 250)
      : typeof data.error === "string"
        ? data.error.slice(0, 250)
        : fallback;
  }
  function recordReceiptDetails(entry, result) {
    if (
      result.warning === "DUPLICATE_CAPTURES" &&
      Number.isInteger(result.captureCount) &&
      result.captureCount > 1
    ) {
      entry.warning = "DUPLICATE_CAPTURES";
      entry.captureCount = Math.max(
        entry.captureCount || 1,
        result.captureCount,
      );
    }
    entry.message = errorMessage(
      result,
      "The captured event matches this request ID.",
    );
  }
  function receiverReady() {
    return (
      state.receiver &&
      state.receiver.provider === "ntfy" &&
      UUID.test(state.receiver.receiverId)
    );
  }
  function readReceiver() {
    try {
      const saved = JSON.parse(localStorage.getItem(RECEIVER_KEY) || "null");
      if (saved && saved.provider === "ntfy" && UUID.test(saved.receiverId))
        state.receiver = saved;
    } catch {
      /* Live setup remains available when local storage is blocked. */
    }
  }
  function renderConnection() {
    const real = state.mode === "real";
    const ready = receiverReady();
    $("#mode-badge").textContent = real
      ? "Live test · real HTTP delivery"
      : "Practice mode · no external sends";
    $("#connection-description").textContent = real
      ? "Create your own test inbox, send a reviewed synthetic event, and verify that ntfy.sh received it. No account or API key required."
      : "Rehearse success, rejection and an uncertain result locally. Practice runs never contact the external service.";
    $("#connect-receiver").hidden = !real;
    $("#connect-receiver").disabled =
      state.connecting || state.submitting || Boolean(ready);
    $("#connect-receiver").textContent = state.connecting
      ? "Connecting…"
      : ready
        ? "Inbox connected ✓"
        : "Connect my test inbox →";
    const status = $("#receiver-status");
    status.replaceChildren();
    if (!real)
      status.append(
        node(
          "p",
          "",
          "Your live inbox is unchanged. Return to Live test when you want a real delivery.",
        ),
      );
    else if (ready) {
      const link = node("a", "text-link", "Open my test inbox ↗︎");
      link.href = viewerUrl(state.receiver.receiverId);
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      status.append(
        link,
        node(
          "p",
          "",
          "Connected · captured messages are retained for about 12 hours. Anyone with this topic URL can read or write test messages. Synthetic content only; use at most two live sends.",
        ),
      );
    } else
      status.append(
        node(
          "p",
          "",
          "Each student gets a unique test inbox. No account or API key. Use at most two live sends; practice mode covers repeated failure tests.",
        ),
      );
    if ($("#action-dialog").open) updateReviewMode();
  }
  async function connectReceiver() {
    if (state.connecting || state.submitting) return;
    state.connecting = true;
    renderConnection();
    try {
      const result = await apiJson("/api/receiver", {});
      if (
        result.state !== "ready" ||
        result.provider !== "ntfy" ||
        !UUID.test(result.receiverId)
      ) {
        throw new Error(
          errorMessage(
            result,
            result.responseStatus === 429
              ? "The server is temporarily rate limited. Wait briefly and try again; reuse your connected inbox when available."
              : "The test inbox could not be connected. Try again or choose Practice mode.",
          ),
        );
      }
      state.receiver = {
        receiverId: result.receiverId,
        provider: "ntfy",
      };
      try {
        localStorage.setItem(RECEIVER_KEY, JSON.stringify(state.receiver));
      } catch {
        notify(
          "Inbox connected for this visit. Browser storage is unavailable.",
        );
      }
      notify(
        "Your real test inbox is connected. Review an order before sending an event.",
      );
    } catch (error) {
      const message =
        error instanceof Error && error.name !== "AbortError"
          ? error.message
          : "The inbox connection timed out. No order was sent. Try again later.";
      $("#receiver-status").textContent = message;
      $("#form-status").textContent = message;
      notify(message);
    } finally {
      state.connecting = false;
      // Keep a useful error message when connecting failed.
      if (receiverReady()) renderConnection();
      else {
        $("#connect-receiver").disabled = false;
        $("#connect-receiver").textContent = "Connect my test inbox →";
        if ($("#action-dialog").open) updateReviewMode();
      }
    }
  }
  function updateReviewMode() {
    const real = state.mode === "real";
    const ready = receiverReady();
    $("#dialog-title").textContent = real
      ? "Review and send an event"
      : "Prepare a practice request";
    $("#dialog-description").textContent = real
      ? "Check the synthetic order and edit the message. Confirming sends one real HTTP event to your personal ntfy.sh test inbox."
      : "Check the context and edit the request. This is a local rehearsal; confirming will not contact any external service.";
    $("#destination-label").textContent = real
      ? "External destination"
      : "Practice destination label";
    $("#action-destination").readOnly = real;
    $("#action-destination").value = real
      ? ready
        ? `https://ntfy.sh/ie-action-lab-${state.receiver.receiverId}`
        : "Connect your test inbox before sending"
      : "Practice · local action queue";
    $("#destination-help").textContent = real
      ? "Only the synthetic order and reviewed message are sent to this receiver. No email or GitHub ticket is created."
      : "This label does not connect a service. Nothing is sent externally.";
    $("#scenario-field").hidden = real;
    $("#review-connect").hidden = !real || ready;
    $("#review-connect-receiver").disabled = state.connecting;
    $("#review-connect-receiver").textContent = state.connecting
      ? "Connecting…"
      : "Connect my test inbox";
    $("#review-mode-label").textContent = real
      ? "Live test · real external delivery"
      : "Practice mode · no external sends";
    $("#review-mode-description").textContent = real
      ? "The event is sent to ntfy.sh, then its receipt is checked. Your history is stored in this browser."
      : "Your simulated request and result are saved in this browser only.";
    $("#confirm-action").textContent = real
      ? "Send real test event →"
      : "Confirm practice action →";
    $("#confirm-action").disabled = state.submitting || (real && !ready);
  }
  async function verifyReceipt(entry, { quiet = false } = {}) {
    if (entry.mode !== "real" || state.verifying.has(entry.id)) return;
    let verifiedNow = false;
    state.verifying.add(entry.id);
    renderHistory();
    try {
      const result = await apiJson("/api/verify-event", {
        receiverId: entry.receiverId,
        requestId: entry.id,
      });
      if (
        result.state === "received" &&
        result.requestId === entry.id &&
        CAPTURE_ID.test(result.captureId)
      ) {
        verifiedNow = true;
        entry.status = "received";
        entry.captureId = result.captureId;
        entry.receivedAt = result.receivedAt || new Date().toISOString();
        recordReceiptDetails(entry, result);
      } else {
        if (entry.status !== "received" && entry.status !== "accepted")
          entry.status = "unknown";
        entry.message = errorMessage(
          result,
          entry.status === "received"
            ? "This event was verified earlier, but its capture is currently unavailable. Cached messages are retained for about 12 hours."
            : "No matching captured receipt was verified yet. Use Verify receipt again; this button does not resend the event.",
        );
      }
    } catch {
      if (entry.status !== "received" && entry.status !== "accepted")
        entry.status = "unknown";
      entry.message =
        "The receipt lookup failed. No event was resent. Check the inbox or verify again later.";
    } finally {
      state.verifying.delete(entry.id);
      saveHistory();
      renderHistory();
      if (!quiet)
        notify(
          verifiedNow && entry.warning === "DUPLICATE_CAPTURES"
            ? "Receipt verified, but duplicate captures were detected. Do not resend."
            : verifiedNow
              ? "A real captured receipt was verified."
              : entry.status === "received"
                ? "This delivery was verified earlier; its current cached receipt is unavailable. Nothing was resent."
                : "Receipt not verified yet. Nothing was resent.",
        );
    }
  }
  async function confirmReal(event) {
    event.preventDefault();
    if (state.submitting || !state.dialogOrderId || !receiverReady()) return;
    const title = $("#action-title"),
      reason = $("#action-reason");
    if (![title, reason].every(validateInput)) return;
    if (!globalThis.crypto?.randomUUID) {
      $("#form-status").textContent =
        "Live delivery needs a secure HTTPS page or localhost to create a stable request ID.";
      return;
    }
    state.submitting = true;
    $("#confirm-action").disabled = true;
    $("#cancel-action").disabled = true;
    $("#close-dialog").disabled = true;
    $("#delivery-mode").disabled = true;
    $("#form-status").textContent =
      "Sending one real event and checking its external receipt…";
    const entry = {
      id: crypto.randomUUID(),
      mode: "real",
      receiverId: state.receiver.receiverId,
      orderId: state.dialogOrderId,
      title: title.value.trim(),
      reason: reason.value.trim(),
      destination: "ntfy.sh · personal test inbox",
      status: "sending",
      createdAt: new Date().toISOString(),
    };
    state.history.unshift(entry);
    state.history = state.history.slice(0, MAX_HISTORY);
    saveHistory();
    renderHistory();
    try {
      const result = await apiJson("/api/send-event", {
        receiverId: entry.receiverId,
        requestId: entry.id,
        orderId: entry.orderId,
        title: entry.title,
        reason: entry.reason,
      });
      const matched = result.requestId === entry.id;
      entry.status =
        matched &&
        ["received", "accepted", "unknown", "rejected"].includes(result.state)
          ? result.state
          : result.state === "invalid"
            ? "rejected"
            : "unknown";
      if (entry.status === "received" && CAPTURE_ID.test(result.captureId))
        entry.captureId = result.captureId;
      else if (entry.status === "received") entry.status = "accepted";
      if (result.httpStatus) entry.httpStatus = result.httpStatus;
      entry.message = errorMessage(result, "");
      if (entry.status === "received") recordReceiptDetails(entry, result);
      if (["accepted", "unknown"].includes(entry.status)) {
        // Allow the external message cache to settle; only read back, never resend.
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await verifyReceipt(entry, { quiet: true });
      }
    } catch {
      entry.status = "unknown";
      entry.message =
        "The send response was lost or unreadable. The event may exist. Verify the receipt before considering another send.";
    } finally {
      entry.completedAt = new Date().toISOString();
      saveHistory();
      state.submitting = false;
      $("#cancel-action").disabled = false;
      $("#close-dialog").disabled = false;
      $("#delivery-mode").disabled = false;
      closeReview();
      renderConnection();
      renderHistory();
      notify(
        entry.warning === "DUPLICATE_CAPTURES"
          ? "Receipt verified, but duplicate captures were detected. Do not resend."
          : `${REAL_RESULTS[entry.status].label}. ${entry.status === "received" ? "Open the inbox to inspect the real event." : "Check the activity record before taking another step."}`,
      );
      $("#history").scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }
  function openReview() {
    if (state.submitting) return;
    const order = state.orders.find((item) => item.id === state.selectedId);
    if (!order) return;
    state.dialogOrderId = order.id;
    const flags = signals(order);
    $("#action-form").reset();
    ["#action-title", "#action-reason", "#action-destination"].forEach(
      (selector) => $(selector).setCustomValidity(""),
    );
    $("#action-title").value =
      `Review ${order.id}: ${flags.length ? flags.map((key) => SIGNALS[key].short.toLowerCase()).join(" / ") : "operational check"}`;
    $("#action-reason").value =
      `Please review ${order.id} (${order.product}). Net sales are ${exactMoney.format(net(order))}, contribution is ${exactMoney.format(profit(order))}, and refunds are ${exactMoney.format(order.refund)}. ${order.note}\n\nResponsible team: ${order.owner}. What should we verify before taking the next step?`;
    const context = $("#review-context");
    context.replaceChildren(
      node("strong", "", `${order.id} · ${order.product}`),
      node(
        "span",
        "",
        `${order.region} / ${order.channel} · ${order.owner} · synthetic record`,
      ),
    );
    $("#form-status").textContent = "";
    $("#confirm-action").disabled = false;
    $("#action-dialog").showModal();
    updateReviewMode();
    $("#action-title").focus();
  }
  function closeReview() {
    if (state.submitting) return;
    $("#action-dialog").close();
    state.dialogOrderId = null;
  }
  function validateInput(element) {
    element.setCustomValidity(
      element.value.trim() ? "" : "Enter a value with more than spaces.",
    );
    return element.reportValidity();
  }
  async function confirmPractice(event) {
    event.preventDefault();
    if (state.submitting || !state.dialogOrderId) return;
    const titleInput = $("#action-title"),
      reasonInput = $("#action-reason"),
      destinationInput = $("#action-destination");
    if (![titleInput, reasonInput, destinationInput].every(validateInput))
      return;
    if (reasonInput.value.trim().length < 10) {
      reasonInput.setCustomValidity(
        "Explain the reason in at least 10 characters.",
      );
      reasonInput.reportValidity();
      return;
    }
    const scenario = $("#action-scenario").value;
    if (!["success", "rejected", "uncertain"].includes(scenario)) return;
    state.submitting = true; // Set synchronously before any wait: repeated clicks cannot create another request.
    $("#confirm-action").disabled = true;
    $("#cancel-action").disabled = true;
    $("#close-dialog").disabled = true;
    $("#form-status").textContent =
      "Running a local rehearsal… No external request is being made.";
    const entry = {
      id: `practice-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`,
      mode: "practice",
      orderId: state.dialogOrderId,
      title: titleInput.value.trim(),
      reason: reasonInput.value.trim(),
      destination: destinationInput.value.trim(),
      status: "processing",
      scenario,
      createdAt: new Date().toISOString(),
    };
    state.history.unshift(entry);
    state.history = state.history.slice(0, MAX_HISTORY);
    saveHistory();
    renderHistory();
    await new Promise((resolve) => setTimeout(resolve, 700));
    entry.status = scenario;
    entry.completedAt = new Date().toISOString();
    saveHistory();
    state.submitting = false;
    $("#cancel-action").disabled = false;
    $("#close-dialog").disabled = false;
    closeReview();
    renderHistory();
    notify(
      `${RESULTS[scenario].label}. Saved ${state.storageAvailable ? "on this device" : "for this visit only"}; nothing was sent externally.`,
    );
    $("#history").scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "nearest",
    });
  }
  function exportHistory() {
    const report = {
      application: "Northstar Action Lab",
      mode: "Live ntfy.sh deliveries and local simulations are labeled per request",
      exportedAt: new Date().toISOString(),
      dataAsOf: state.asOf,
      requests: state.history,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = node("a");
    link.href = url;
    link.download = "northstar-action-history.json";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function bindEvents() {
    $("#delivery-mode").addEventListener("change", (event) => {
      if (state.submitting) return;
      state.mode = event.target.value === "practice" ? "practice" : "real";
      renderConnection();
      renderDetail();
    });
    $("#connect-receiver").addEventListener("click", connectReceiver);
    $("#review-connect-receiver").addEventListener("click", connectReceiver);
    $("#search").addEventListener("input", (event) => {
      state.filters.search = event.target.value;
      renderWorkspace();
    });
    $("#signal-filter").addEventListener("change", (event) => {
      state.filters.signal = event.target.value;
      renderWorkspace();
    });
    $("#status-filter").addEventListener("change", (event) => {
      state.filters.status = event.target.value;
      renderWorkspace();
    });
    $("#clear-filters").addEventListener("click", () => {
      state.filters = { search: "", signal: "all", status: "all" };
      $("#search").value = "";
      $("#signal-filter").value = "all";
      $("#status-filter").value = "all";
      renderWorkspace();
      $("#search").focus();
    });
    $("#action-form").addEventListener("submit", (event) =>
      state.mode === "real" ? confirmReal(event) : confirmPractice(event),
    );
    ["#action-title", "#action-reason", "#action-destination"].forEach(
      (selector) =>
        $(selector).addEventListener("input", (event) =>
          event.target.setCustomValidity(""),
        ),
    );
    $("#close-dialog").addEventListener("click", closeReview);
    $("#cancel-action").addEventListener("click", closeReview);
    $("#action-dialog").addEventListener("cancel", (event) => {
      if (state.submitting) event.preventDefault();
    });
    $("#export-history").addEventListener("click", exportHistory);
    $("#reset-history").addEventListener("click", () => {
      if (!state.submitting) {
        // Native dialog returnValue survives reopening; Escape must never reuse
        // a previous confirmed reset.
        $("#reset-dialog").returnValue = "";
        $("#reset-dialog").showModal();
      }
    });
    $("#reset-dialog").addEventListener("close", () => {
      if ($("#reset-dialog").returnValue !== "reset" || state.submitting)
        return;
      state.history = [];
      saveHistory();
      renderHistory();
      notify(
        "Local history cleared. Captured ntfy.sh events and your inbox are unchanged.",
      );
    });
  }
  function validOrder(order) {
    const stringFields = [
      "id",
      "product",
      "category",
      "region",
      "channel",
      "orderDate",
      "promisedDate",
      "status",
      "owner",
      "note",
    ];
    return (
      order &&
      stringFields.every((key) => typeof order[key] === "string") &&
      ["quantity", "revenue", "cost", "refund"].every(
        (key) => Number.isFinite(order[key]) && order[key] >= 0,
      ) &&
      ["delivered", "in_transit", "processing"].includes(order.status) &&
      /^\d{4}-\d{2}-\d{2}$/.test(order.orderDate) &&
      /^\d{4}-\d{2}-\d{2}$/.test(order.promisedDate) &&
      (order.deliveredDate === null ||
        /^\d{4}-\d{2}-\d{2}$/.test(order.deliveredDate))
    );
  }
  async function start() {
    bindEvents();
    readHistory();
    readReceiver();
    renderConnection();
    renderHistory();
    try {
      const response = await fetch(new URL("./data.json", document.baseURI));
      if (!response.ok) throw new Error("Dataset request failed");
      const data = await response.json();
      if (
        !Array.isArray(data.orders) ||
        !data.orders.length ||
        !data.orders.every(validOrder) ||
        new Set(data.orders.map((order) => order.id)).size !==
          data.orders.length ||
        !/^\d{4}-\d{2}-\d{2}$/.test(data.meta?.asOf)
      )
        throw new Error("Invalid dataset");
      state.orders = data.orders;
      state.asOf = data.meta.asOf;
      state.selectedId =
        state.orders.find((order) => signals(order).includes("negative"))?.id ||
        state.orders[0].id;
      $("#snapshot-date").dateTime = state.asOf;
      $("#snapshot-date").textContent = dateLabel(state.asOf);
      renderWorkspace();
    } catch {
      const error = $("#load-error");
      error.textContent =
        "The bundled data could not be loaded. Reload this page. If you downloaded the copy, serve its folder with a local web server rather than opening the HTML file directly. See the workshop guide for the start command.";
      error.hidden = false;
      $("#order-count").textContent = "Data unavailable";
    }
  }
  start();
})();
