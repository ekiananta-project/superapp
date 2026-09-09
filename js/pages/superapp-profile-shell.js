(() => {
  "use strict";
  const AVATAR_BUCKET="profile-avatars";
  function clean(value){const s=String(value??"").trim().replace(/\s+/g," ");return !s||["undefined","null","[object object]"].includes(s.toLowerCase())?"Profil Saya":s}
  function url(profile){if(!profile?.avatar_path||!window.supabaseClient)return"";const{data}=window.supabaseClient.storage.from(AVATAR_BUCKET).getPublicUrl(profile.avatar_path);const raw=data?.publicUrl||"";return raw?`${raw}${raw.includes("?")?"&":"?"}v=${encodeURIComponent(String(profile.updated_at||"1"))}`:""}
  async function init(){if(window.AUTH_READY){const ok=await window.AUTH_READY;if(ok===false)return}try{const profile=await FamilyService.ambilProfilSaya();const name=document.querySelector("[data-profile-shell-name]");if(name)name.textContent=clean(profile?.display_name);const root=document.querySelector("[data-profile-shell-avatar]");const src=url(profile);if(root&&src){root.replaceChildren();const img=document.createElement("img");img.src=src;img.alt="";img.decoding="async";root.appendChild(img)}}catch(error){console.warn("[Profile shell]",error)}}
  document.addEventListener("DOMContentLoaded",init,{once:true});
})();
