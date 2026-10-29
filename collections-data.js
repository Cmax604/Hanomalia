// Catalogue et albums : modifier ce fichier pour ajouter les photos et les informations.
// Un article : {name:"...",category:"...",description:"...",image:"assets/...",price:"20 €",sizes:["S","M","L"],orderUrl:"https://..."}.
// Un album : {title:"Nom de l'événement",date:"2026-09-12",location:"Ville / salle",photos:[{src:"assets/...",alt:"Description",caption:"Crédit photo"}]}.
window.HANOMALIA_COLLECTIONS = {
  merch: [
    {name:"Casquette",category:"Accessoire",price:"20 €",image:null,description:"",sizes:[],orderUrl:null},
    {name:"T-shirt",category:"Vêtement",price:"20 €",image:null,description:"",sizes:[],orderUrl:null}
  ],
  albums: [
    {title:"Taverne Electrik",date:"2026-09-12",location:"",photos:[]},
    {title:"Fête de la musique 2026",date:null,dateLabel:"2026",location:"",photos:[]}
  ]
};