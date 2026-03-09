
let library=[]
let setlist=STORE.getSetlist()
let currentIndex=0

async function loadOnline(){
const r=await fetch("content/online-library/manifest.json")
const j=await r.json()
library=[...j.musics]

const localPDFs=STORE.getLocalPDFs()
localPDFs.forEach(p=>{
library.push({title:p.name,artist:"PDF Local",lyrics:"[PDF] "+p.name,pdf:p.url})
})

renderLibrary()
}

function renderLibrary(){
const box=document.getElementById("library")
box.innerHTML=""
library.forEach((s,i)=>{
const div=document.createElement("div")
div.className="song"
div.innerText=s.title+" - "+(s.artist||"")
div.onclick=()=>openSong(i)
box.appendChild(div)
})
}

function openSong(i){
currentIndex=i
const s=library[i]
document.getElementById("title").innerText=s.title
document.getElementById("meta").innerText=s.artist||""

if(s.pdf){
document.getElementById("viewer").innerHTML='<iframe src="'+s.pdf+'" width="100%" height="600"></iframe>'
}else{
document.getElementById("viewer").innerText=s.lyrics
}
}

function renderSetlist(){
const box=document.getElementById("setlist")
box.innerHTML=""
setlist.forEach((s,i)=>{
const d=document.createElement("div")
d.className="setlist-item"
d.innerText=(i+1)+". "+s.title
box.appendChild(d)
})
STORE.saveSetlist(setlist)
}

document.getElementById("addSetlist").onclick=()=>{
const s=library[currentIndex]
setlist.push(s)
renderSetlist()
}

document.getElementById("next").onclick=()=>{
if(currentIndex<library.length-1){openSong(currentIndex+1)}
}

document.getElementById("prev").onclick=()=>{
if(currentIndex>0){openSong(currentIndex-1)}
}

document.getElementById("pdfInput").onchange=e=>{
const f=e.target.files[0]
const url=URL.createObjectURL(f)
const list=STORE.getLocalPDFs()
list.push({name:f.name,url})
STORE.saveLocalPDFs(list)
alert("PDF adicionado")
loadOnline()
}

loadOnline()
renderSetlist()
