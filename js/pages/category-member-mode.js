(() => {
  "use strict";

  /* The historical category editor showed read-only mode to anyone except the
     creator/owner. Product rule is now family-member managed. The database RPCs
     still perform the real active-membership authorization. This page-local
     adapter only removes the obsolete UI role gate without changing FamilyService
     behavior anywhere else in RuangKitha. */
  const original = window.FamilyService?.ambilKeluargaSaya;
  if (typeof original !== "function") return;

  window.FamilyService.ambilKeluargaSaya = async function (...args) {
    const families = await original.apply(this, args);
    return (families || []).map(family => ({
      ...family,
      membership: family.membership
        ? { ...family.membership, role: "owner" }
        : family.membership
    }));
  };
})();
