(() => {
  "use strict";

  const client = window.supabaseClient;

  if (!client) {
    throw new Error("supabaseClient belum tersedia.");
  }

  function lemparJikaError(error) {
    if (error) throw error;
  }

  async function wajibUser() {
    const user = await window.AuthService.ambilUserAktif();

    if (!user) {
      throw new Error("User belum login.");
    }

    return user;
  }

  async function ambilProfilSaya() {
    const user = await wajibUser();

    const { data, error } = await client
      .from("profiles")
      .select("id,display_name,avatar_path,created_at,updated_at")
      .eq("id", user.id)
      .single();

    lemparJikaError(error);
    return data;
  }

  async function ambilKeluargaSaya() {
    const user = await wajibUser();

    const { data: memberships, error: memberError } = await client
      .from("family_members")
      .select("id,family_id,user_id,role,relationship,status,joined_at")
      .eq("user_id", user.id)
      .eq("status", "active");

    lemparJikaError(memberError);

    if (!memberships.length) {
      return [];
    }

    const familyIds = memberships.map(item => item.family_id);

    const { data: families, error: familyError } = await client
      .from("families")
      .select("id,name,timezone,default_currency,created_by,created_at,updated_at,archived_at")
      .in("id", familyIds)
      .is("archived_at", null);

    lemparJikaError(familyError);

    const membershipMap = new Map(
      memberships.map(item => [item.family_id, item])
    );

    return families.map(family => ({
      ...family,
      membership: membershipMap.get(family.id) || null
    }));
  }

  async function ambilKeluargaById(familyId) {
    if (!familyId) {
      throw new Error("familyId wajib diisi.");
    }

    const { data, error } = await client
      .from("families")
      .select("id,name,timezone,default_currency,created_by,created_at,updated_at,archived_at")
      .eq("id", familyId)
      .single();

    lemparJikaError(error);
    return data;
  }

  async function ambilAnggotaKeluarga(familyId) {
    if (!familyId) {
      throw new Error("familyId wajib diisi.");
    }

    const { data: members, error: memberError } = await client
      .from("family_members")
      .select("id,family_id,user_id,role,relationship,status,joined_at,removed_at")
      .eq("family_id", familyId)
      .eq("status", "active")
      .order("joined_at", { ascending: true });

    lemparJikaError(memberError);

    if (!members.length) {
      return [];
    }

    const userIds = members.map(item => item.user_id);

    const { data: profiles, error: profileError } = await client
      .from("profiles")
      .select("id,display_name,avatar_path")
      .in("id", userIds);

    lemparJikaError(profileError);

    const profileMap = new Map(
      profiles.map(item => [item.id, item])
    );

    return members.map(member => ({
      ...member,
      profile: profileMap.get(member.user_id) || null
    }));
  }

  async function buatKeluarga({
    name,
    timezone = "Asia/Jakarta",
    currency = "IDR"
  }) {
    const nama = String(name || "").trim();

    if (!nama) {
      throw new Error("Nama keluarga wajib diisi.");
    }

    const { data, error } = await client.rpc(
      "create_family",
      {
        p_name: nama,
        p_timezone: timezone,
        p_default_currency: currency
      }
    );

    lemparJikaError(error);
    return data;
  }

  async function ubahKeluarga(familyId, perubahan) {
    if (!familyId) {
      throw new Error("familyId wajib diisi.");
    }

    const update = {};

    if (perubahan.name !== undefined) {
      const nama = String(perubahan.name).trim();

      if (!nama) {
        throw new Error("Nama keluarga tidak boleh kosong.");
      }

      update.name = nama;
    }

    if (perubahan.timezone !== undefined) {
      update.timezone = String(perubahan.timezone).trim();
    }

    if (perubahan.default_currency !== undefined) {
      update.default_currency =
        String(perubahan.default_currency).trim().toUpperCase();
    }

    if (!Object.keys(update).length) {
      return ambilKeluargaById(familyId);
    }

    const { data, error } = await client
      .from("families")
      .update(update)
      .eq("id", familyId)
      .select("id,name,timezone,default_currency,updated_at")
      .single();

    lemparJikaError(error);
    return data;
  }

  function normalisasiKodeUndangan(kode) {
    const raw = String(kode || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 12);

    if (raw.length !== 12) {
      throw new Error("Kode undangan harus terdiri dari 12 karakter.");
    }

    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
  }

  function barisPertama(data) {
    if (Array.isArray(data)) return data[0] || null;
    return data || null;
  }

  async function buatUndanganKeluarga({
    familyId,
    relationship = null,
    expiresHours = 24
  }) {
    if (!familyId) {
      throw new Error("familyId wajib diisi.");
    }

    const hubungan = String(relationship || "").trim() || null;

    const { data, error } = await client.rpc(
      "family_create_invitation",
      {
        p_family_id: familyId,
        p_relationship: hubungan,
        p_expires_hours: Number(expiresHours || 24)
      }
    );

    lemparJikaError(error);
    return barisPertama(data);
  }

  async function ambilUndanganAktif(familyId) {
    if (!familyId) {
      throw new Error("familyId wajib diisi.");
    }

    const { data, error } = await client.rpc(
      "family_get_active_invitation",
      { p_family_id: familyId }
    );

    lemparJikaError(error);
    return barisPertama(data);
  }

  async function previewUndangan(kode) {
    const kodeBersih = normalisasiKodeUndangan(kode);

    const { data, error } = await client.rpc(
      "family_preview_invitation",
      { p_code: kodeBersih }
    );

    lemparJikaError(error);
    return barisPertama(data);
  }

  async function terimaUndangan(kode) {
    await wajibUser();

    const kodeBersih = normalisasiKodeUndangan(kode);

    const { data, error } = await client.rpc(
      "family_accept_invitation",
      { p_code: kodeBersih }
    );

    if (error) {
      console.error("[family_accept_invitation]", error);
      throw new Error(
        error.message ||
        error.details ||
        error.hint ||
        "Undangan gagal diterima."
      );
    }

    let familyId = data;

    if (Array.isArray(familyId)) {
      familyId = familyId[0] || null;
    }

    if (familyId && typeof familyId === "object") {
      familyId = familyId.family_id || familyId.id || null;
    }

    if (!familyId || typeof familyId !== "string") {
      throw new Error("Backend tidak mengembalikan Family ID setelah menerima undangan.");
    }

    return familyId;
  }


  async function transferKepemilikan(familyId, userIdPemilikBaru) {
    if (!familyId) {
      throw new Error("familyId wajib diisi.");
    }

    if (!userIdPemilikBaru) {
      throw new Error("User pemilik baru wajib diisi.");
    }

    const { data, error } = await client.rpc(
      "family_transfer_ownership",
      {
        p_family_id: familyId,
        p_new_owner_user_id: userIdPemilikBaru
      }
    );

    lemparJikaError(error);
    return barisPertama(data);
  }

  async function keluarkanAnggota(familyId, userId) {
    if (!familyId) {
      throw new Error("familyId wajib diisi.");
    }

    if (!userId) {
      throw new Error("userId anggota wajib diisi.");
    }

    const { data, error } = await client.rpc(
      "family_remove_member",
      {
        p_family_id: familyId,
        p_user_id: userId
      }
    );

    lemparJikaError(error);
    return data;
  }

  async function cabutUndangan(invitationId) {
    if (!invitationId) {
      throw new Error("Invitation ID wajib diisi.");
    }

    const { data, error } = await client.rpc(
      "family_revoke_invitation",
      { p_invitation_id: invitationId }
    );

    lemparJikaError(error);
    return data;
  }

  window.FamilyService = {
    ambilProfilSaya,
    ambilKeluargaSaya,
    ambilKeluargaById,
    ambilAnggotaKeluarga,
    buatKeluarga,
    ubahKeluarga,
    normalisasiKodeUndangan,
    buatUndanganKeluarga,
    ambilUndanganAktif,
    previewUndangan,
    terimaUndangan,
    transferKepemilikan,
    keluarkanAnggota,
    cabutUndangan
  };
})();
