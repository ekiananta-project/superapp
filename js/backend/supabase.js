(() => {
  "use strict";

  const SUPABASE_URL =
    "https://eipviruaffujxsfpupki.supabase.co";

  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_MbXuo1BZL5HPCTaApwhsNw_MCy9kehC";

  if (!window.supabase) {
    throw new Error(
      "Library Supabase belum dimuat. Muat supabase-js sebelum js/backend/supabase.js."
    );
  }

  if (!window.supabaseClient) {
    window.supabaseClient = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );
  }

  window.SUPABASE_CONFIG = {
    url: SUPABASE_URL,
    keyType: "publishable"
  };
})();
