// Ajouter ici les vrais articles et albums : les deux pages les affichent automatiquement.
// Un article : {name:"...",category:"...",description:"...",image:"assets/...",price:"25 €",sizes:["S","M","L"],orderUrl:"https://..."}.
// Un album : {title:"Nom de l'événement",date:"2026-10-29",location:"Ville / salle",photos:[{src:"assets/...",alt:"Description",caption:"Crédit photo"}]}.
window.HANOMALIA_COLLECTIONS = {
  merch: [],
  albums: [{
    title: "Archives du groupe",
    date: null,
    location: "",
    preview: true,
    photos: [
      {src:"assets/Billy.webp",alt:"Billy à la guitare sur scène",caption:"Billy / HANOMALIA"},
      {src:"assets/concert-original.webp",alt:"HANOMALIA et son public en concert",caption:"HANOMALIA / Live"},
      {src:"assets/Alex.webp",alt:"Alex au chant sur scène",caption:"Alex / HANOMALIA"},
      {src:"assets/Bastien.webp",alt:"Bastien à la guitare sur scène",caption:"Bastien / HANOMALIA"},
      {src:"assets/Max.webp",alt:"Max à la basse sur scène",caption:"Max / HANOMALIA"}
    ]
  }]
};
