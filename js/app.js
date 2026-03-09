
let library=[]
let currentSong=null
let transpose=0

async function loadLibrary(){

const r=await fetch("content/online-library/manifest.json")
const j=await r.json()

library=j.musics
renderLibrary()

}

function renderLibrary(){

const box=document.getElementById("library")
box.innerHTML=""

library.forEach((s,i)=>{

const d=document.createElement("div")
d.className="song"
d.innerText=s.title+" - "+(s.artist||"")

d.onclick=()=>openSong(i)

box.appendChild(d)

})

}

function openSong(i){

currentSong=library[i]
transpose=0
renderSong()

}

function renderSong(){

let text=currentSong.lyrics||""

document.getElementById("title").innerText=currentSong.title+" (tom "+transpose+")"

document.getElementById("viewer").innerText=text

}

document.getElementById("transposeUp").onclick=()=>{

transpose++
renderSong()

}

document.getElementById("transposeDown").onclick=()=>{

transpose--
renderSong()

}

document.getElementById("favorite").onclick=()=>{

const fav=STORE.getFavorites()

fav.push(currentSong)

STORE.saveFavorites(fav)

alert("Favoritado")

}

document.getElementById("saveSetlist").onclick=()=>{

const setlists=STORE.getSetlists()

setlists.push({
date:new Date().toISOString(),
song:currentSong
})

STORE.saveSetlists(setlists)

renderSetlists()

}

function renderSetlists(){

const box=document.getElementById("setlists")

const list=STORE.getSetlists()

box.innerHTML=""

list.forEach(s=>{

const d=document.createElement("div")
d.innerText=s.song.title

box.appendChild(d)

})

}

loadLibrary()
renderSetlists()
