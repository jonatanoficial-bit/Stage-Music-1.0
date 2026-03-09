
const STORE={
getSetlists(){return JSON.parse(localStorage.getItem("stage_setlists")||"[]")},
saveSetlists(d){localStorage.setItem("stage_setlists",JSON.stringify(d))},
getFavorites(){return JSON.parse(localStorage.getItem("stage_favorites")||"[]")},
saveFavorites(d){localStorage.setItem("stage_favorites",JSON.stringify(d))}
}
