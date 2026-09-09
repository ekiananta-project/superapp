(() => {
  "use strict";
  const months = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  let cursor = new Date(); cursor = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const iso = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  function render(){
    const title=document.querySelector("[data-calendar-title]"); const grid=document.querySelector("[data-calendar-grid]"); if(!title||!grid)return;
    title.textContent=`${months[cursor.getMonth()]} ${cursor.getFullYear()}`; grid.replaceChildren();
    const first=new Date(cursor.getFullYear(),cursor.getMonth(),1); const start=new Date(first); start.setDate(first.getDate()-first.getDay()); const today=iso(new Date());
    for(let i=0;i<42;i++){
      const d=new Date(start); d.setDate(start.getDate()+i); const b=document.createElement("button"); b.type="button"; b.className="calendar-day"; b.textContent=String(d.getDate()); b.setAttribute("aria-label",d.toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"}));
      if(d.getMonth()!==cursor.getMonth())b.classList.add("is-outside"); if(d.getDay()===0)b.classList.add("is-sunday"); if(iso(d)===today)b.classList.add("is-today"); grid.appendChild(b);
    }
  }
  document.addEventListener("DOMContentLoaded",()=>{document.querySelector("[data-calendar-prev]")?.addEventListener("click",()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()-1,1);render()});document.querySelector("[data-calendar-next]")?.addEventListener("click",()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()+1,1);render()});render();},{once:true});
})();
