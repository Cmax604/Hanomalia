import {REPOSITORY,CONTENT_PATH,PAGE_NAMES,validateDocument,encodeText,decodeText,publishDocument,referencedUploads,listVersions} from './core.mjs';
import {readVersion,fetchHistory} from './versions.mjs';
if(window.top!==window){document.body.replaceChildren(document.createTextNode('Ouvre l’administration directement dans un onglet pour te connecter.'));throw Error('Administration cannot be embedded');}
const $=id=>document.getElementById(id);
const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
let content=null,baselineSha=null,token='',account='',uploads=[],dirty=false,tab='pages',pageName='index.html',saveTimer,busy=false;
let restoreCommit=null,expectedHead=null,legacyVersion=false,versionHistory=null,pendingVersion=null;
let lastPublished=null;const previewUrls=[];
const endpoint='https://api.github.com/repos/'+REPOSITORY;
const status=message=>{$('save-status').textContent=message;};
const error=message=>{$('workspace-error').textContent=message||'';};
async function github(path,{method='GET',body,publicRequest=false}={}){
 const headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
 if(token&&!publicRequest)headers.Authorization='Bearer '+token;
 if(body)headers['Content-Type']='application/json';
 const url=path==='/user'?'https://api.github.com/user':endpoint+path;
 const response=await fetch(url,{method,headers,body:body?JSON.stringify(body):undefined,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000)});
 if(!response.ok){const detail=await response.json().catch(()=>({}));let message='GitHub a refusé la demande ('+response.status+').';
 if(response.status===401)message='Clé d’accès invalide ou expirée. Reconnecte-toi avec une clé valide.';
 if(response.status===403)message='Accès refusé. Vérifie que la clé autorise le dépôt Hanomalia avec Contents : Read and write.';
 if(response.status===409||response.status===422)message='La version GitHub a changé ou cette modification est refusée. Exporte ton brouillon puis recharge la version GitHub.';
 if(response.status===404)message='Le dépôt ou le contenu est introuvable avec cette clé. Vérifie les dépôts autorisés.';
 const failure=Error(message);failure.status=response.status;failure.detail=detail.message;throw failure;}
 return response.status===204?null:response.json();
}
function openDatabase(){return new Promise((resolve,reject)=>{const request=indexedDB.open('hanomalia-administration',1);request.onupgradeneeded=()=>request.result.createObjectStore('drafts');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function readDraft(){const db=await openDatabase();return new Promise((resolve,reject)=>{const request=db.transaction('drafts','readonly').objectStore('drafts').get('v2');request.onsuccess=()=>{resolve(request.result);db.close();};request.onerror=()=>{reject(request.error);db.close();};});}
async function saveDraft(){
 if(!content)return;clearTimeout(saveTimer);
 const needed=referencedUploads(content);uploads=uploads.filter(u=>needed.has(u.path));
 const snapshot={document:content,baselineSha,uploads,dirty,lastPublished,restoreCommit,expectedHead,legacyVersion,savedAt:new Date().toISOString()};
 const db=await openDatabase();await new Promise((resolve,reject)=>{const tx=db.transaction('drafts','readwrite');tx.objectStore('drafts').put(snapshot,'v2');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});
 status(dirty?'Brouillon enregistré sur cet appareil · '+new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'Brouillon enregistré.');
}
function changed(){dirty=true;status('Modifications non publiées');clearTimeout(saveTimer);saveTimer=setTimeout(()=>saveDraft().catch(()=>error('Le brouillon n’a pas pu être enregistré sur cet appareil. Exporte une sauvegarde avant de fermer.')),900);}
async function fileSha(text){const bytes=new TextEncoder().encode(text);const prefix=new TextEncoder().encode('blob '+bytes.length+'\0');const blob=new Uint8Array(prefix.length+bytes.length);blob.set(prefix);blob.set(bytes,prefix.length);return [...new Uint8Array(await crypto.subtle.digest('SHA-1',blob))].map(v=>v.toString(16).padStart(2,'0')).join('');}
async function loadPublished(){const response=await fetch('../content/site.json',{cache:'no-store'});if(!response.ok)throw Error('Le contenu du site ne peut pas être chargé. Réessaie dans un instant.');const text=await response.text();content=validateDocument(JSON.parse(text));baselineSha=await fileSha(text);uploads=[];dirty=false;restoreCommit=null;expectedHead=null;legacyVersion=false;}
async function ensureDraft(){if(content)return;const draft=await readDraft().catch(()=>null);if(draft?.document){content=validateDocument(draft.document);baselineSha=draft.baselineSha;uploads=Array.isArray(draft.uploads)?draft.uploads:[];dirty=Boolean(draft.dirty);lastPublished=draft.lastPublished||null;restoreCommit=draft.restoreCommit||null;expectedHead=draft.expectedHead||null;legacyVersion=Boolean(draft.legacyVersion);}else await loadPublished();}
function enterWorkspace(){
 $('welcome').hidden=true;$('workspace').hidden=false;
 $('connection-state').textContent=token?'Connecté : '+account+' · publication sur la V2 uniquement':'Brouillon local · connecte-toi à GitHub pour publier';
 $('connect-button').hidden=Boolean(token);$('logout-button').hidden=!token;$('publish-button').disabled=!token||busy;
 render();status(dirty?'Brouillon repris · modifications non publiées':'Contenu chargé · aucune modification non publiée');
}
async function handle(action){if(busy)return;error('');try{await action();}catch(e){error(e.message||'Une erreur est survenue.');}}
function button(text,action,cls='outline',label){const b=node('button',cls,text);b.type='button';if(label)b.setAttribute('aria-label',label);b.addEventListener('click',()=>handle(action));return b;}
function field(label,value,set,{type='text',multiline=false,min,step}={}){
 const wrap=node('label','field');wrap.append(node('span','',label));const input=node(multiline?'textarea':'input');if(!multiline)input.type=type;input.value=value??'';
 if(min!==undefined)input.min=min;if(step)input.step=step;
 input.addEventListener('input',()=>{set(input.value);changed();});wrap.append(input);return wrap;
}
function checkbox(label,value,set){const wrap=node('label','check-field');const input=node('input');input.type='checkbox';input.checked=value;input.addEventListener('change',()=>{set(input.checked);changed();});wrap.append(input,node('span','',label));return wrap;}
function uploadLabel(label,callback,multiple=false){const wrap=node('label','file-label',label);const input=node('input');input.type='file';input.accept='image/jpeg,image/png,image/webp,image/avif';input.multiple=multiple;input.addEventListener('change',()=>handle(async()=>{if(!input.files.length)return;await uploadImages([...input.files],callback);input.value='';}));wrap.append(input);return wrap;}
function previewSource(path){const pending=uploads.find(u=>u.path===path);return pending?'data:'+pending.mime+';base64,'+pending.base64:path?(path.startsWith('assets/')?'../'+path:path):'';}
function mediaEditor(value,set,label='Photo',alt,setAlt){const wrap=node('div','media-editor');const src=previewSource(value);if(src){const img=node('img');img.src=src;img.alt=label;wrap.append(img);}else wrap.append(node('div','no-image','Photo à ajouter'));
 const controls=node('div','media-controls');controls.append(uploadLabel('Choisir une photo',async photos=>{set(photos[0].path);changed();render();}));
 if(setAlt)controls.append(field('Description de l’image',alt,setAlt));
 const details=node('details');details.append(node('summary','','Adresse de l’image'));details.append(field('Fichier ou adresse HTTPS',value,set));controls.append(details);wrap.append(controls);return wrap;}
async function uploadImages(files,callback){
 if(files.length>40)throw Error('Ajoute au maximum 40 photos à la fois.');
 busy=true;$('publish-button').disabled=true;const prepared=[];
 try{for(let i=0;i<files.length;i++){
  const file=files[i];if(!['image/jpeg','image/png','image/webp','image/avif'].includes(file.type))throw Error('Format non pris en charge : '+file.name+'. Utilise un fichier JPG, PNG, WebP ou AVIF.');
  if(file.size>100*1024*1024)throw Error('Cette photo dépasse 100 Mo : '+file.name);
  status('Préparation des photos : '+(i+1)+' / '+files.length);
  let bitmap;try{bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});}catch{throw Error('La photo '+file.name+' ne peut pas être lue. Vérifie son format (les fichiers RAW doivent être convertis).');}
  if(bitmap.width*bitmap.height>100000000){bitmap.close();throw Error('Photo trop grande : '+file.name);}
  const scale=Math.min(1,2000/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.88));canvas.width=canvas.height=1;
  if(!blob||blob.type!=='image/webp')throw Error('Ton navigateur ne peut pas préparer cette image au format WebP.');
  const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});
  prepared.push({path:'assets/uploads/'+Date.now()+'-'+crypto.randomUUID().slice(0,8)+'.webp',mime:'image/webp',base64:dataUrl.split(',')[1],name:file.name});
 }
 uploads.push(...prepared);await callback(prepared);await saveDraft();
 }finally{busy=false;$('publish-button').disabled=!token;}
}
function renderPages(root){
 const selector=node('label','page-selector','Page à modifier');const select=node('select');for(const name of PAGE_NAMES){const option=node('option','',content.pages[name].label);option.value=name;option.selected=name===pageName;select.append(option);}select.addEventListener('change',()=>{pageName=select.value;render();});selector.append(select);root.append(selector,node('p','editor-note','Les changements restent dans ton brouillon jusqu’à la publication. Les textes sont regroupés par section de la page.'));
 const groups=new Map();for(const item of content.pages[pageName].fields){if(!groups.has(item.group))groups.set(item.group,[]);groups.get(item.group).push(item);}
 const ordered=[...groups].sort(([a],[b])=>(['Navigation','Pied de page'].includes(a)?1:0)-(['Navigation','Pied de page'].includes(b)?1:0));
 let first=true;for(const [name,fields] of ordered){const section=node('details','field-group');section.open=first;first=false;section.append(node('summary','',name==='Hero title'?'Logo principal':name));
 for(const item of fields){
  if(item.type==='image'){section.append(node('p','',item.label));section.append(mediaEditor(item.value,v=>item.value=v,item.label,item.alt,v=>item.alt=v));}
  else section.append(field(item.label,item.value,v=>item.value=v,{multiline:item.type==='text'&&item.value.length>90}));
 }
 root.append(section);}
}
function move(array,index,delta){const target=index+delta;if(target<0||target>=array.length)return;[array[index],array[target]]=[array[target],array[index]];changed();render();}
function actions(array,index,name){const actions=node('div','small-actions');const up=button('↑',()=>move(array,index,-1),'', 'Monter '+name);up.disabled=index===0;const down=button('↓',()=>move(array,index,1),'','Descendre '+name);down.disabled=index===array.length-1;actions.append(up,down,button('Retirer',()=>{if(confirm('Retirer '+name+' du brouillon ? Le site ne changera qu’après publication.')){array.splice(index,1);changed();render();}},'danger','Retirer '+name));return actions;}
function renderMerch(root){root.append(node('p','editor-note','Ajoute tes articles, leurs photos, leurs prix et les tailles. Le bouton Commander apparaît uniquement si tu renseignes une destination de commande.'));const list=node('div','cards-list');
 content.collections.merch.forEach((product,index)=>{const card=node('article','card');const top=node('div','card-top');top.append(node('h2','',product.name||'Nouvel article'),actions(content.collections.merch,index,product.name||'cet article'));card.append(top,mediaEditor(product.image,v=>product.image=v,product.name));
 const columns=node('div','two-columns');columns.append(field('Nom de l’article',product.name,v=>product.name=v),field('Catégorie',product.category,v=>product.category=v));const numeric=parseFloat(String(product.price||'').replace(',','.'));columns.append(field('Prix (€)',Number.isFinite(numeric)?numeric:'',v=>product.price=v?Number(v).toFixed(2).replace('.00','')+' €':'',{type:'number',min:0,step:'.01'}),field('Tailles (séparées par des virgules)',(product.sizes||[]).join(', '),v=>product.sizes=v.split(',').map(s=>s.trim()).filter(Boolean)));card.append(columns,field('Description',product.description,v=>product.description=v,{multiline:true}),field('Lien de commande (facultatif)',product.orderUrl,v=>product.orderUrl=v||null),checkbox('Article disponible',product.available!==false,v=>product.available=v),checkbox('Afficher cet article sur le site',product.published!==false,v=>product.published=v));list.append(card);});
 root.append(list,button('+ Ajouter un article',()=>{content.collections.merch.push({name:'Nouvel article',category:'',price:'',image:null,description:'',sizes:[],orderUrl:null,available:true,published:true});changed();render();},'primary add-button'));
}
function renderGallery(root){root.append(node('p','editor-note','Les événements sont classés du plus récent au plus ancien. Ajoute plusieurs photos à la fois, puis utilise les flèches pour choisir leur ordre. Les couleurs originales sont conservées.'));const list=node('div','cards-list');
 content.collections.albums.forEach((album,index)=>{const card=node('article','card');const top=node('div','card-top');top.append(node('h2','',album.title||'Nouvel événement'),actions(content.collections.albums,index,album.title||'cet événement'));card.append(top);
 const columns=node('div','two-columns');columns.append(field('Nom de l’événement',album.title,v=>album.title=v),field('Date de l’événement',album.date,v=>{album.date=v||null;if(v)delete album.dateLabel;},{type:'date'}),field('Lieu / salle (facultatif)',album.location,v=>album.location=v),field('Année, si la date est inconnue',album.dateLabel,v=>album.dateLabel=v));card.append(columns,checkbox('Afficher cet événement sur le site',album.published!==false,v=>album.published=v));
 card.append(uploadLabel('Ajouter des photos à cet album',async photos=>{for(const photo of photos)album.photos.push({src:photo.path,alt:album.title+' — '+photo.name.replace(/\.[^.]+$/,''),caption:album.title});changed();render();},true));card.append(node('p','hint',album.photos.length+' photos'));
 const photosGrid=node('div','album-photo-grid');album.photos.forEach((photo,photoIndex)=>{const p=node('article','photo-edit');const img=node('img');img.src=previewSource(photo.src);img.alt=photo.alt||album.title;img.loading='lazy';p.append(img,actions(album.photos,photoIndex,'la photo '+(photoIndex+1)),field('Description de la photo',photo.alt,v=>photo.alt=v),field('Légende / crédit photo',photo.caption,v=>photo.caption=v),uploadLabel('Remplacer',async photos=>{photo.src=photos[0].path;changed();render();}));photosGrid.append(p);});card.append(photosGrid);list.append(card);});
 root.append(list,button('+ Ajouter un événement',()=>{content.collections.albums.unshift({title:'Nouvel événement',date:null,location:'',photos:[],published:true});changed();render();},'primary add-button'));
}
function render(){if(!content)return;const root=$('editor');const scroll=window.scrollY;root.replaceChildren();$('section-title').textContent={pages:'Textes & images',merch:'Merch',gallery:'Galerie',versions:'Versions'}[tab];document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===tab);b.setAttribute('aria-pressed',String(b.dataset.tab===tab));});if(restoreCommit){root.append(node('p','version-notice','Version '+restoreCommit.slice(0,7)+' chargée en brouillon. Sa publication restaurera la disposition, les styles, les photos et les contenus de cette version, tout en conservant cette administration.'),button('Annuler le chargement de cette version',()=>reloadCurrent(false)));} if(legacyVersion&&tab!=='versions'){root.append(node('p','editor-note','Cette version précède l’administration. Ses fichiers seront restaurés tels quels. Les formulaires seront disponibles après le chargement d’une version compatible.'));}else ({pages:renderPages,merch:renderMerch,gallery:renderGallery,versions:renderVersions}[tab])(root);window.scrollTo({top:scroll,behavior:'instant'});}
function makePreview(){if(restoreCommit)throw Error('L’aperçu interactif utilise la disposition actuelle. Pour cette restauration, consulte les fichiers de la version dans l’onglet Versions.');validateDocument(content);const draft=structuredClone(content);const urls=new Map();for(const upload of uploads){const bytes=Uint8Array.from(atob(upload.base64),c=>c.charCodeAt(0));const url=URL.createObjectURL(new Blob([bytes],{type:upload.mime}));previewUrls.push(url);urls.set(upload.path,url);}
 const visit=value=>{if(Array.isArray(value))return value.map(visit);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,visit(v)]));return urls.get(value)||value;};
 sessionStorage.setItem('hanomalia-preview',JSON.stringify(visit(draft)));$('preview-frame').src='../'+$('preview-page').value+'?cms-preview=1&draft='+Date.now();
}
async function pollDeployment(commit){for(let attempt=0;attempt<45;attempt++){await new Promise(resolve=>setTimeout(resolve,5000));let runs;try{runs=await github('/actions/runs?head_sha='+encodeURIComponent(commit),{publicRequest:true});}catch{status('Changements enregistrés dans GitHub. Vérifie la publication dans Actions.');return;}const run=runs.workflow_runs?.find(r=>r.path==='.github/workflows/pages.yml');if(!run)continue;if(run.status==='completed'){if(run.conclusion==='success')status('La V2 est publiée. Actualise le site pour voir les changements.');else error('Le contenu est enregistré, mais la publication a échoué. Consulte les Actions du dépôt GitHub.');return;}status('Contenu enregistré · publication de la V2 en cours…');}status('Contenu enregistré. La publication prend plus de temps ; consulte les Actions GitHub.');}
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.tab;error('');render();}));
$('open-draft').addEventListener('click',()=>handle(async()=>{await ensureDraft();enterWorkspace();}));
$('connect-button').addEventListener('click',()=>{$('welcome').hidden=false;$('workspace').hidden=true;$('access-key').focus();});
$('login-form').addEventListener('submit',async event=>{event.preventDefault();$('login-error').textContent='';const submit=event.currentTarget.querySelector('button');submit.disabled=true;token=$('access-key').value.trim();$('access-key').value='';try{if(!token)throw Error('Renseigne une clé d’accès GitHub.');const user=await github('/user');const repository=await github('');if(!repository.permissions?.push)throw Error('Ce compte n’a pas le droit de modifier le dépôt Hanomalia.');const remote=await github('/contents/'+CONTENT_PATH+'?ref=main');const remoteDocument=validateDocument(JSON.parse(decodeText(remote.content)));await ensureDraft();if(!dirty){content=remoteDocument;baselineSha=remote.sha;uploads=[];}account=user.login;enterWorkspace();if(dirty&&baselineSha!==remote.sha)error('Le contenu GitHub a changé depuis ce brouillon. Exporte-le puis recharge la version GitHub avant de publier.');}catch(e){token='';account='';$('login-error').textContent=e.message;}finally{submit.disabled=false;}});
$('logout-button').addEventListener('click',()=>{token='';account='';enterWorkspace();status('Déconnecté. Ton brouillon reste sur cet appareil.');});
$('save-draft').addEventListener('click',()=>handle(saveDraft));
$('publish-button').addEventListener('click',()=>handle(async()=>{if(!token)throw Error('Connecte-toi à GitHub avant de publier.');validateDocument(content);if(!confirm('Publier ce brouillon sur la V2 ? Le site officiel Hanomalia_Band restera inchangé.'))return;busy=true;$('workspace').classList.add('busy');$('publish-button').disabled=true;
 try{await saveDraft();const result=await publishDocument({api:github,document:content,uploads,baselineSha,restoreCommit,expectedHead,onProgress:status});baselineSha=result.contentSha;uploads=[];dirty=false;lastPublished=result.commit;restoreCommit=null;expectedHead=null;legacyVersion=false;versionHistory=null;render();await saveDraft();status('Changements enregistrés · publication en cours…');pollDeployment(result.commit).catch(()=>status('Contenu enregistré. Vérifie la publication dans GitHub Actions.'));}finally{busy=false;$('workspace').classList.remove('busy');$('publish-button').disabled=!token;}}));
$('preview-button').addEventListener('click',()=>handle(()=>{$('preview-page').value=tab==='gallery'?'galerie.html':tab==='merch'?'merch.html':pageName;makePreview();$('preview-dialog').showModal();}));
$('preview-page').addEventListener('change',()=>handle(makePreview));$('preview-refresh').addEventListener('click',()=>handle(makePreview));$('preview-close').addEventListener('click',()=>$('preview-dialog').close());$('preview-dialog').addEventListener('close',()=>{$('preview-frame').src='about:blank';sessionStorage.removeItem('hanomalia-preview');previewUrls.splice(0).forEach(url=>URL.revokeObjectURL(url));});
$('export-button').addEventListener('click',()=>handle(()=>{const payload={format:'hanomalia-backup-v1',document:content,uploads,baselineSha,restoreCommit,expectedHead,legacyVersion};const url=URL.createObjectURL(new Blob([JSON.stringify(payload)],{type:'application/json'}));const link=node('a');link.href=url;link.download='hanomalia-brouillon-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}));
$('import-backup').addEventListener('change',()=>handle(async()=>{const file=$('import-backup').files[0];if(!file)return;if(file.size>150*1024*1024)throw Error('Cette sauvegarde est trop volumineuse.');const backup=JSON.parse(await file.text());if(backup.format!=='hanomalia-backup-v1')throw Error('Ce fichier n’est pas une sauvegarde HANOMALIA.');validateDocument(backup.document);const pending=backup.uploads||[];if(!Array.isArray(pending)||pending.some(u=>!/^assets\/uploads\/[a-zA-Z0-9-]+\.webp$/.test(u.path)||typeof u.base64!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(u.base64)))throw Error('Images de sauvegarde invalides.');if(!confirm('Remplacer le brouillon actuel par cette sauvegarde ?'))return;content=backup.document;uploads=pending;baselineSha=backup.baselineSha||null;restoreCommit=backup.restoreCommit||null;expectedHead=backup.expectedHead||null;legacyVersion=Boolean(backup.legacyVersion);if(restoreCommit&&!/^[a-f0-9]{40}$/.test(restoreCommit))throw Error('Version de sauvegarde invalide.');dirty=true;await saveDraft();render();$('import-backup').value='';}));
async function reloadCurrent(ask=true){
 if(ask&&!confirm('Recharger le contenu publié et remplacer le brouillon local ? Exporte une sauvegarde si tu veux le conserver.'))return;
 if(token){const remote=await github('/contents/'+CONTENT_PATH+'?ref=main');content=validateDocument(JSON.parse(decodeText(remote.content)));baselineSha=remote.sha;uploads=[];dirty=false;}else await loadPublished();
 restoreCommit=null;expectedHead=null;legacyVersion=false;await saveDraft();render();error('');
}
$('reload-remote').addEventListener('click',()=>handle(()=>reloadCurrent()));
async function loadVersion(version){
 pendingVersion=null;
 status('Chargement de la version…');
 const snapshot=await readVersion(github,version.sha);
 content=snapshot.document;baselineSha=snapshot.baselineSha;restoreCommit=snapshot.restoreCommit;expectedHead=snapshot.expectedHead;legacyVersion=snapshot.legacy;
 uploads=[];dirty=true;await saveDraft();render();status('Version V'+version.number+' chargée · publie pour restaurer le site.');
}
function renderVersions(root){
 root.append(node('p','editor-note','Chaque enregistrement sur la branche principale de GitHub crée une version, y compris depuis l’administration. Une restauration crée une nouvelle version : l’historique reste intact. Les versions sont des sauvegardes des fichiers ; une publication GitHub en échec peut aussi apparaître.'));
 root.append(button('Actualiser l’historique GitHub',async()=>{status('Lecture de l’historique GitHub…');const versions=await listVersions(github);versionHistory={current:versionHistory?.current,versions};render();status('Historique actualisé.');}));
 if(!versionHistory){root.append(node('p','hint','Chargement de l’historique…'));fetchHistory(github).then(data=>{versionHistory=data;if(tab==='versions')render();}).catch(e=>error(e.message));return;}
 root.append(node('p','hint',versionHistory.versions.length+' versions · sélectionne une version pour la charger en brouillon.'));
 const list=node('div','version-list');
 for(const version of versionHistory.versions){
  const card=node('article','card version-card');const title=node('h2','', 'V'+version.number+' · '+version.title);
  card.append(title,node('p','hint',new Date(version.date).toLocaleString('fr-FR')+' · '+version.author+' · '+version.sha.slice(0,7)));
  if(version.sha===versionHistory.current)card.append(node('span','version-badge','Version actuellement déployée au dernier chargement de la page'));
  if(version.sha===restoreCommit)card.append(node('span','version-badge','Chargée dans le brouillon'));
  if(pendingVersion?.sha===version.sha){const confirmation=node('div','version-notice');confirmation.append(node('p','','Remplacer le brouillon par V'+version.number+' ? Exporte une sauvegarde pour conserver ton travail. Le site restera inchangé jusqu’à publication.'),button('Confirmer le chargement',()=>loadVersion(version),'primary'),button('Annuler',()=>{pendingVersion=null;render();}));card.append(confirmation);}
  const controls=node('div','version-actions');controls.append(button('Charger cette version',()=>{pendingVersion=version;render();}));
  const source=node('a','','Consulter les fichiers ↗');source.href='https://github.com/'+REPOSITORY+'/tree/'+version.sha;source.target='_blank';source.rel='noopener';controls.append(source);card.append(controls);list.append(card);
 }
 root.append(list);
}
window.addEventListener('beforeunload',event=>{if(busy){event.preventDefault();event.returnValue='';}});
readDraft().then(draft=>{if(draft?.document)$('open-draft').textContent='Reprendre mon brouillon';}).catch(()=>{});
