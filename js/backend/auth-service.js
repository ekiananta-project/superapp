(() => {
  "use strict";

  const client = window.supabaseClient;

  if (!client) {
    throw new Error(
      "supabaseClient belum tersedia. Muat supabase.js terlebih dahulu."
    );
  }

  function lemparJikaError(error) {
    if (error) throw error;
  }

  function emailBersih(email) {
    return String(email || "").trim().toLowerCase();
  }

  function namaBersih(nama) {
    return String(nama || "").trim().replace(/\s+/g, " ");
  }

  async function login(email, password) {
    const emailFinal = emailBersih(email);

    if (!emailFinal) {
      throw new Error("Email wajib diisi.");
    }

    if (!password) {
      throw new Error("Password wajib diisi.");
    }

    const { data, error } = await client.auth.signInWithPassword({
      email: emailFinal,
      password
    });

    lemparJikaError(error);

    return {
      user: data.user,
      session: data.session
    };
  }

  async function daftar({ nama, email, password }) {
    const displayName = namaBersih(nama);
    const emailFinal = emailBersih(email);

    if (displayName.length < 2) {
      throw new Error("Nama minimal 2 karakter.");
    }

    if (!emailFinal) {
      throw new Error("Email wajib diisi.");
    }

    if (!password || String(password).length < 8) {
      throw new Error("Password minimal 8 karakter.");
    }

    const { data, error } = await client.auth.signUp({
      email: emailFinal,
      password,
      options: {
        emailRedirectTo: new URL("login.html", window.location.href).href,
        data: {
          display_name: displayName
        }
      }
    });

    lemparJikaError(error);

    return {
      user: data.user,
      session: data.session,
      perluKonfirmasiEmail: Boolean(data.user && !data.session)
    };
  }

  async function kirimResetPassword(email) {
    const emailFinal = emailBersih(email);
    if (!emailFinal) throw new Error("Email wajib diisi.");

    const redirectTo = new URL("login.html?mode=reset", window.location.href).href;
    const { error } = await client.auth.resetPasswordForEmail(emailFinal, {
      redirectTo
    });
    lemparJikaError(error);
    return true;
  }

  async function ubahPasswordBaru(password) {
    if (!password || String(password).length < 8) {
      throw new Error("Password minimal 8 karakter.");
    }

    const { data, error } = await client.auth.updateUser({ password });
    lemparJikaError(error);
    return data.user || null;
  }

  async function reautentikasi(password) {
    if (!password) throw new Error("Password saat ini wajib diisi.");

    const user = await ambilUserAktif();
    const email = emailBersih(user?.email);
    if (!email) throw new Error("Email akun aktif tidak ditemukan.");

    const { data, error } = await client.auth.signInWithPassword({
      email,
      password
    });
    lemparJikaError(error);
    return data.user || null;
  }

  async function ubahEmailLogin(emailBaru, passwordSaatIni) {
    const emailFinal = emailBersih(emailBaru);
    if (!emailFinal) throw new Error("Email baru wajib diisi.");

    const user = await ambilUserAktif();
    if (!user) throw new Error("User belum login.");
    if (emailBersih(user.email) === emailFinal) {
      throw new Error("Email baru masih sama dengan email login saat ini.");
    }

    await reautentikasi(passwordSaatIni);

    const { data, error } = await client.auth.updateUser(
      { email: emailFinal },
      { emailRedirectTo: new URL("pengaturan.html", window.location.href).href }
    );
    lemparJikaError(error);
    return data.user || null;
  }

  async function gantiPassword(passwordSaatIni, passwordBaru) {
    if (!passwordBaru || String(passwordBaru).length < 8) {
      throw new Error("Password baru minimal 8 karakter.");
    }
    if (passwordSaatIni === passwordBaru) {
      throw new Error("Password baru harus berbeda dari password saat ini.");
    }

    await reautentikasi(passwordSaatIni);
    return ubahPasswordBaru(passwordBaru);
  }

  async function logout(scope = "local") {
    const scopeValid = ["local", "global", "others"].includes(scope)
      ? scope
      : "local";

    const { error } = await client.auth.signOut({ scope: scopeValid });
    lemparJikaError(error);
    return true;
  }

  async function ambilSession() {
    const { data, error } = await client.auth.getSession();
    lemparJikaError(error);
    return data.session || null;
  }

  async function ambilUserAktif() {
    const { data, error } = await client.auth.getUser();
    lemparJikaError(error);
    return data.user || null;
  }

  async function sudahLogin() {
    return Boolean(await ambilSession());
  }

  async function ubahNamaProfil(nama) {
    const displayName = namaBersih(nama);

    if (displayName.length < 2) {
      throw new Error("Nama minimal 2 karakter.");
    }

    const user = await ambilUserAktif();
    if (!user) {
      throw new Error("User belum login.");
    }

    /*
     * public.profiles.display_name adalah single source of truth.
     * Update profile harus sukses; Auth metadata hanya mirror kompatibilitas.
     */
    const { error: profileError } = await client
      .from("profiles")
      .update({ display_name: displayName })
      .eq("id", user.id);

    lemparJikaError(profileError);

    try {
      const { error: authError } = await client.auth.updateUser({
        data: {
          ...(user.user_metadata || {}),
          display_name: displayName
        }
      });

      if (authError) {
        console.warn("[Auth metadata mirror]", authError);
      }
    } catch (error) {
      console.warn("[Auth metadata mirror]", error);
    }

    return displayName;
  }

  async function sinkronProfilSaya() {
    const user = await ambilUserAktif();
    if (!user) return null;

    const { data: profile, error } = await client
      .from("profiles")
      .select("id,display_name")
      .eq("id", user.id)
      .maybeSingle();

    lemparJikaError(error);
    if (!profile) return null;

    const namaProfil = namaBersih(profile.display_name || "");
    const namaProfilValid =
      namaProfil &&
      !["undefined", "null", "[object object]"].includes(
        namaProfil.toLowerCase()
      );

    /* Profile valid tidak pernah dioverwrite dari user_metadata. */
    if (namaProfilValid) {
      return profile;
    }

    const fallback =
      namaBersih(user.user_metadata?.display_name || "") ||
      String(user.email || "").split("@")[0].trim();

    if (!fallback) return profile;

    const { data, error: updateError } = await client
      .from("profiles")
      .update({ display_name: fallback })
      .eq("id", user.id)
      .select("id,display_name")
      .single();

    lemparJikaError(updateError);
    return data;
  }

  function pantauPerubahanAuth(callback) {
    if (typeof callback !== "function") {
      throw new Error("Callback wajib berupa function.");
    }

    const { data } = client.auth.onAuthStateChange((event, session) => {
      callback({
        event,
        session,
        user: session?.user || null
      });
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }

  window.AuthService = {
    login,
    daftar,
    kirimResetPassword,
    ubahPasswordBaru,
    reautentikasi,
    ubahEmailLogin,
    gantiPassword,
    logout,
    ambilSession,
    ambilUserAktif,
    sudahLogin,
    ubahNamaProfil,
    sinkronProfilSaya,
    pantauPerubahanAuth
  };
})();
