export const REPOSITORY = 'Cmax604/Hanomalia';
export const CONTENT_PATH = 'content/site.json';
export const PAGE_NAMES = ['index.html','groupe.html','membres.html','live.html','merch.html','galerie.html'];
export function safeLink(value) {
  if(typeof value!=='string'||/[\u0000-\u001f]/.test(value))return false;
  try { const url=new URL(value,'https://cmax604.github.io/Hanomalia/'); return ['https:','http:','mailto:'].includes(url.protocol); } catch {return false;}
}
export function safeImage(value) {
  return typeof value==='string' && (/^assets\/[a-zA-Z0-9_./ -]+$/.test(value)&&!value.split('/').includes('..') || /^https:\/\//.test(value)&&safeLink(value));
}
export function validateDocument(doc) {
  if(!doc||doc.version!==1||!doc.pages||!doc.collections)throw Error('Le fichier de contenu est invalide.');
  for(const name of PAGE_NAMES){
    const page=doc.pages[name];if(!page||!Array.isArray(page.fields)||page.fields.length>1500)throw Error('Page manquante ou invalide : '+name);
    const ids=new Set();
    for(const field of page.fields){
      if(!field.id||ids.has(field.id)||!['text','image','url'].includes(field.type)||typeof field.value!=='string'||field.value.length>30000)throw Error('Un champ de la page '+page.label+' est invalide.');
      ids.add(field.id);
      if(field.type==='image'&&!safeImage(field.value))throw Error('Adresse d’image invalide : '+field.label);
      if(field.type==='url'&&!safeLink(field.value))throw Error('Lien invalide : '+field.label);
    }
  }
  const {merch,albums}=doc.collections;
  if(!Array.isArray(merch)||!Array.isArray(albums)||merch.length>500||albums.length>200)throw Error('Catalogue ou albums invalides.');
  for(const product of merch){
    if(!product.name?.trim())throw Error('Chaque article doit avoir un nom.');
    if(product.image&&!safeImage(product.image))throw Error('Photo invalide : '+product.name);
    if(product.orderUrl&&!safeLink(product.orderUrl))throw Error('Lien de commande invalide : '+product.name);
    if(product.price&&!/^\d+(?:[.,]\d{1,2})?\s*€?$/.test(product.price))throw Error('Prix invalide : '+product.name);
    if(product.sizes&&!Array.isArray(product.sizes))throw Error('Tailles invalides : '+product.name);
  }
  for(const album of albums){
    if(!album.title?.trim()||!Array.isArray(album.photos)||album.photos.length>2000)throw Error('Album invalide.');
    if(album.date&&(!/^\d{4}-\d{2}-\d{2}$/.test(album.date)||!Number.isFinite(Date.parse(album.date+'T12:00:00Z'))||new Date(album.date+'T12:00:00Z').toISOString().slice(0,10)!==album.date))throw Error('Date invalide : '+album.title);
    for(const photo of album.photos)if(!safeImage(photo.src))throw Error('Photo invalide : '+album.title);
  }
  return doc;
}
export function referencedUploads(doc){
  const paths=new Set();
  const visit=value=>{if(typeof value==='string'&&value.startsWith('assets/uploads/'))paths.add(value);else if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')Object.values(value).forEach(visit);};
  visit(doc);return paths;
}
export function encodeText(text){let binary='';for(const byte of new TextEncoder().encode(text))binary+=String.fromCharCode(byte);return btoa(binary);}
export function decodeText(content){return new TextDecoder().decode(Uint8Array.from(atob(content.replace(/\s/g,'')),c=>c.charCodeAt(0)));}
export async function publishDocument({api,document,uploads,baselineSha,onProgress=()=>{}}){
  validateDocument(document);
  if(!baselineSha)throw Error('Reconnecte-toi à GitHub pour vérifier la version avant de publier.');
  const ref=await api('/git/ref/heads/main');const head=ref.object.sha;
  const current=await api('/contents/'+CONTENT_PATH+'?ref='+head);
  if(current.sha!==baselineSha){const error=Error('Le contenu a changé sur GitHub depuis ton ouverture. Exporte ton brouillon, puis recharge la version publiée avant de continuer.');error.code='CONFLICT';throw error;}
  const commit=await api('/git/commits/'+head);
  const needed=referencedUploads(document);const entries=[];
  const selected=uploads.filter(u=>needed.has(u.path));
  for(let i=0;i<selected.length;i++){
    const upload=selected[i];
    if(!/^assets\/uploads\/[a-zA-Z0-9-]+\.webp$/.test(upload.path)||typeof upload.base64!=='string')throw Error('Fichier image invalide.');
    onProgress('Envoi des photos : '+(i+1)+' / '+selected.length);
    const blob=await api('/git/blobs',{method:'POST',body:{content:upload.base64,encoding:'base64'}});
    entries.push({path:upload.path,mode:'100644',type:'blob',sha:blob.sha});
  }
  onProgress('Enregistrement du contenu…');
  const content=JSON.stringify(document,null,2)+'\n';
  const blob=await api('/git/blobs',{method:'POST',body:{content,encoding:'utf-8'}});
  entries.push({path:CONTENT_PATH,mode:'100644',type:'blob',sha:blob.sha});
  const tree=await api('/git/trees',{method:'POST',body:{base_tree:commit.tree.sha,tree:entries}});
  const saved=await api('/git/commits',{method:'POST',body:{message:'Mettre à jour les contenus depuis l’administration',tree:tree.sha,parents:[head]}});
  await api('/git/refs/heads/main',{method:'PATCH',body:{sha:saved.sha,force:false}});
  return {commit:saved.sha,contentSha:blob.sha};
}
