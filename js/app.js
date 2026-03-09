
async function loadLibrary(){
const res = await fetch('content/online-library/manifest.json');
const data = await res.json();

const list = document.getElementById('musicList');

data.musics.forEach(m=>{
const li=document.createElement('li');
li.innerText=m.title + ' - ' + m.artist;
li.onclick=()=>showMusic(m);
list.appendChild(li);
})
}

function showMusic(m){
document.getElementById('musicContent').innerText = m.lyrics;
}

loadLibrary();
