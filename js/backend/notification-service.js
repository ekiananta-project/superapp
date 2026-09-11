// RuangKitha v2.0.0a46a — Calendar-centered Notification foundation + readable Edge Function errors.
(() => {
  "use strict";

  const EDGE_FUNCTION = "notification-push";
  const SYNC_HOURS = 24 * 30;

  function client() {
    if (!window.supabaseClient) throw new Error("Supabase belum tersedia.");
    return window.supabaseClient;
  }

  function clean(value) {
    return String(value ?? "").trim();
  }

  function timezone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }
    catch { return "UTC"; }
  }

  function browserInfo() {
    const ua = navigator.userAgent || "";
    let browser = "Browser";
    if (/Edg\//.test(ua)) browser = "Edge";
    else if (/OPR\//.test(ua)) browser = "Opera";
    else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser = "Chrome";
    else if (/Firefox\//.test(ua)) browser = "Firefox";
    else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = "Safari";

    let platform = "Perangkat";
    if (/iPhone|iPad|iPod/.test(ua)) platform = "iPhone/iPad";
    else if (/Android/.test(ua)) platform = "Android";
    else if (/Windows/.test(ua)) platform = "Windows";
    else if (/Macintosh|Mac OS X/.test(ua)) platform = "Mac";
    else if (/Linux/.test(ua)) platform = "Linux";

    return { browser, platform, label: `${browser} · ${platform}` };
  }

  function isStandalone() {
    return Boolean(
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      navigator.standalone === true
    );
  }

  function isIOS() {
    return /iPhone|iPad|iPod/.test(navigator.userAgent || "");
  }

  function supported() {
    return Boolean(
      window.isSecureContext &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window
    );
  }

  function base64ToBytes(base64String) {
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    return Uint8Array.from([...raw].map(ch => ch.charCodeAt(0)));
  }

  function subscriptionJSON(subscription) {
    if (!subscription) return null;
    if (typeof subscription.toJSON === "function") return subscription.toJSON();
    return JSON.parse(JSON.stringify(subscription));
  }

  async function registration() {
    if (!("serviceWorker" in navigator)) return null;
    try { return await navigator.serviceWorker.ready; }
    catch { return null; }
  }

  async function currentSubscription() {
    const reg = await registration();
    if (!reg?.pushManager) return null;
    try { return await reg.pushManager.getSubscription(); }
    catch { return null; }
  }

  async function dbDevice(endpoint) {
    if (!endpoint) return null;
    try {
      const { data, error } = await client()
        .from("notification_devices")
        .select("id,active,permission_state,last_seen_at,last_push_success_at,last_push_failure_at,verified_at,failure_count,last_error,device_label")
        .eq("endpoint", endpoint)
        .maybeSingle();
      if (error) throw error;
      return data || null;
    } catch (error) {
      console.debug?.("[Notification device lookup]", error);
      return null;
    }
  }

  async function getHealth({ refreshDevice = true } = {}) {
    if (!window.isSecureContext) {
      return { state: "unsupported", supported: false, reason: "secure-context", permission: "unsupported" };
    }
    const permission = "Notification" in window ? (Notification.permission || "default") : "default";
    const iosNeedsInstall = isIOS() && !isStandalone();
    if (iosNeedsInstall) {
      return { state: "install-required", supported: true, permission, iosNeedsInstall: true };
    }
    if (!supported()) {
      return { state: "unsupported", supported: false, reason: "browser", permission: "unsupported" };
    }

    if (permission === "denied") {
      return { state: "blocked", supported: true, permission };
    }
    if (permission !== "granted") {
      return { state: "inactive", supported: true, permission };
    }

    const subscription = await currentSubscription();
    if (!subscription) {
      return { state: "repair", supported: true, permission, subscription: null };
    }

    const device = refreshDevice ? await dbDevice(subscription.endpoint) : null;
    if (device && device.active === false) {
      return { state: "repair", supported: true, permission, subscription, device };
    }
    return {
      state: "active",
      supported: true,
      permission,
      subscription,
      device,
      verified: Boolean(device?.verified_at)
    };
  }

  async function edgeErrorMessage(error, fallback = "Edge Function gagal dipanggil.") {
    try {
      const response = error?.context;
      if (response && typeof response.clone === "function") {
        const data = await response.clone().json();
        const message = clean(data?.message);
        if (message) return message;
      }
    } catch {}
    return clean(error?.message) || fallback;
  }

  async function invokeEdge(body) {
    const { data, error } = await client().functions.invoke(EDGE_FUNCTION, { body });
    if (error) throw new Error(await edgeErrorMessage(error));
    if (data?.ok === false) throw new Error(clean(data?.message) || "Server push menolak permintaan.");
    return data;
  }

  async function edgeConfig() {
    const data = await invokeEdge({ mode: "config" });
    const key = clean(data?.publicKey);
    if (!key) throw new Error("VAPID public key belum dikonfigurasi pada server push.");
    return { publicKey: key };
  }

  async function registerSubscription(subscription) {
    const info = browserInfo();
    const payload = subscriptionJSON(subscription);
    const { data, error } = await client().rpc("notification_register_device_v1", {
      p_subscription: payload,
      p_device_label: info.label,
      p_platform: info.platform,
      p_browser: info.browser,
      p_timezone: timezone(),
      p_permission_state: Notification.permission || "default"
    });
    if (error) throw error;
    return data;
  }

  async function heartbeat() {
    if (!supported() || Notification.permission !== "granted") return getHealth({ refreshDevice: false });
    const subscription = await currentSubscription();
    if (!subscription) return getHealth({ refreshDevice: false });
    try { await registerSubscription(subscription); }
    catch (error) { console.debug?.("[Notification heartbeat]", error); }
    return getHealth();
  }

  async function activate() {
    if (!window.isSecureContext) throw new Error("Notifikasi memerlukan koneksi HTTPS yang aman.");
    if (isIOS() && !isStandalone()) {
      const error = new Error("Di iPhone/iPad, tambahkan RuangKitha ke Layar Utama terlebih dahulu lalu buka dari ikon aplikasi.");
      error.code = "IOS_INSTALL_REQUIRED";
      throw error;
    }
    if (!supported()) throw new Error("Browser/perangkat ini belum mendukung Web Push RuangKitha.");

    let permission = Notification.permission;
    if (permission === "default") permission = await Notification.requestPermission();
    if (permission !== "granted") {
      const error = new Error(permission === "denied"
        ? "Notifikasi diblokir oleh perangkat/browser."
        : "Izin notifikasi belum diberikan.");
      error.code = permission === "denied" ? "PERMISSION_DENIED" : "PERMISSION_DEFAULT";
      throw error;
    }

    const reg = await registration();
    if (!reg?.pushManager) throw new Error("Push Manager belum tersedia pada service worker.");
    let subscription = await reg.pushManager.getSubscription();
    if (subscription) {
      const known = await dbDevice(subscription.endpoint);
      if (known && known.active === false) {
        try { await subscription.unsubscribe(); } catch {}
        subscription = null;
      }
    }
    if (!subscription) {
      const { publicKey } = await edgeConfig();
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64ToBytes(publicKey)
      });
    }
    await registerSubscription(subscription);
    await syncInbox(SYNC_HOURS);
    return getHealth();
  }

  async function deactivate() {
    const subscription = await currentSubscription();
    if (subscription?.endpoint) {
      try {
        const { error } = await client().rpc("notification_disable_device_v1", { p_endpoint: subscription.endpoint });
        if (error) throw error;
      } catch (error) {
        console.warn("[Notification deactivate DB]", error);
      }
      try { await subscription.unsubscribe(); } catch {}
    }
    return getHealth();
  }

  async function testPush() {
    const health = await heartbeat();
    if (health.state !== "active" || !health.subscription?.endpoint) {
      throw new Error("Aktifkan notifikasi pada perangkat ini terlebih dahulu.");
    }
    return await invokeEdge({ mode: "test", endpoint: health.subscription.endpoint });
  }

  async function confirmTestSeen() {
    const health = await getHealth();
    if (health.state !== "active" || !health.subscription?.endpoint) throw new Error("Subscription perangkat tidak tersedia.");
    const { data, error } = await client().rpc("notification_verify_device_v1", { p_endpoint: health.subscription.endpoint });
    if (error) throw error;
    return Boolean(data);
  }

  async function syncInbox(hours = SYNC_HOURS) {
    const { data, error } = await client().rpc("notification_sync_my_inbox_v1", {
      p_horizon_hours: Math.max(24, Math.min(Number(hours || SYNC_HOURS), 24 * 90))
    });
    if (error) throw error;
    return Number(data || 0);
  }

  async function listInbox({ unreadOnly = false, limit = 100 } = {}) {
    let query = client()
      .from("notification_inbox")
      .select("id,event_key,event_date,scheduled_for,rule_key,title,body,source_module,source_type,source_href,read_at,push_sent_at,push_failed_at")
      .lte("scheduled_for", new Date().toISOString())
      .order("scheduled_for", { ascending: false })
      .limit(Math.max(1, Math.min(Number(limit || 100), 200)));
    if (unreadOnly) query = query.is("read_at", null);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async function unreadCount() {
    const { data, error } = await client().rpc("notification_unread_count_v1");
    if (error) throw error;
    return Number(data || 0);
  }

  async function markRead(id) {
    const value = clean(id);
    if (!value) return false;
    const { data, error } = await client().rpc("notification_mark_read_v1", { p_notification_id: value });
    if (error) throw error;
    if (!data) return false;
    window.dispatchEvent(new CustomEvent("ruangkitha:notification-read"));
    return true;
  }

  async function markAllRead() {
    const { data, error } = await client().rpc("notification_mark_all_read_v1");
    if (error) throw error;
    window.dispatchEvent(new CustomEvent("ruangkitha:notification-read"));
    return Number(data || 0);
  }

  function safeHref(raw) {
    const href = clean(raw);
    if (!href) return "kalender.html";
    try {
      const url = new URL(href, location.href);
      if (url.origin !== location.origin) return "kalender.html";
      return `${url.pathname.split("/").pop() || "kalender.html"}${url.search}${url.hash}`;
    } catch { return "kalender.html"; }
  }

  async function openItem(item) {
    if (!item) return;
    try { await markRead(item.id); } catch {}
    location.href = safeHref(item.source_href);
  }

  async function hasRelevantUpcoming() {
    try {
      await syncInbox(SYNC_HOURS);
      const now = new Date().toISOString();
      const future = new Date(Date.now() + SYNC_HOURS * 3600_000).toISOString();
      const { count, error } = await client()
        .from("notification_inbox")
        .select("id", { count: "exact", head: true })
        .gte("scheduled_for", now)
        .lte("scheduled_for", future);
      if (error) throw error;
      return Number(count || 0) > 0;
    } catch (error) {
      console.debug?.("[Notification upcoming]", error);
      return false;
    }
  }

  window.RuangKithaNotifications = {
    supported,
    isStandalone,
    isIOS,
    browserInfo,
    getHealth,
    heartbeat,
    activate,
    deactivate,
    testPush,
    confirmTestSeen,
    syncInbox,
    listInbox,
    unreadCount,
    markRead,
    markAllRead,
    openItem,
    safeHref,
    hasRelevantUpcoming
  };
})();
