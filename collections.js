(() => {
const data=window.HANOMALIA_COLLECTIONS||{merch:[],albums:[]};
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node};
const safeUrl=(value)=>{try{const u=new URL(value,location.href);return (['http:','https:'].includes(u.protocol)||(new URLSearchParams(location.search).get('cms-preview')==='1'&&window.parent!==window&&u.protocol==='blob:'&&u.origin===location.origin))?u.href:null}catch{return null}};
const grid=document.getElementById('merch-grid');
if(grid){
 let productViewer=null;
 function enlarge(photos,name,start,trigger){
  if(productViewer)productViewer.remove();
  const dialog=el('dialog','photo-viewer merch-viewer');dialog.setAttribute('aria-label','Photos de '+name);
  const top=el('div','viewer-top');top.append(el('p','',name));const close=el('button','','Fermer ×');close.type='button';top.append(close);
  const stage=el('div','viewer-stage'),prev=el('button','','←'),next=el('button','','→'),photo=el('img');prev.type=next.type='button';prev.setAttribute('aria-label','Photo précédente');next.setAttribute('aria-label','Photo suivante');stage.append(prev,photo,next);
  const bottom=el('div','viewer-bottom'),caption=el('p'),count=el('p');count.setAttribute('aria-live','polite');bottom.append(caption,count);dialog.append(top,stage,bottom);document.body.append(dialog);productViewer=dialog;
  let selected=start;const display=()=>{photo.src=photos[selected].src;photo.alt=photos[selected].alt||name;caption.textContent=photos[selected].alt||name;count.textContent=(selected+1)+' / '+photos.length;prev.disabled=next.disabled=photos.length<2;};
  const step=delta=>{selected=(selected+delta+photos.length)%photos.length;display();};
  prev.addEventListener('click',()=>step(-1));next.addEventListener('click',()=>step(1));close.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();step(event.key==='ArrowLeft'?-1:1);}});
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  dialog.addEventListener('close',()=>{trigger.focus();dialog.remove();productViewer=null;});display();dialog.showModal();
 }
 const products=Array.isArray(data.merch)?data.merch.filter(product=>product.published!==false):[];
 document.getElementById('merch-note').hidden=products.length>0;
 const entries=products;
 if(!entries.length)grid.append(el('p','product-description','La collection arrive bientôt.'));
 for(const product of entries){
  const card=el('article','product-card');
  const photos=(Array.isArray(product.images)?product.images:product.image?[{src:product.image,alt:product.name}]:[]).filter(p=>p&&p.src&&safeUrl(p.src));
  const imageUrl=photos[0]?.src;
  const visual=el('div',imageUrl?'product-image product-carousel':'product-placeholder');
  const image=el('img');image.src=imageUrl||(product.index===2?'assets/skull-original.png':'assets/logo-horizontal-blanc.png');image.alt=imageUrl?(photos[0].alt||product.name):'';image.loading='lazy';
  let thumbnails=null;
  if(imageUrl){
   let selected=0;const open=el('button','product-zoom');open.type='button';open.setAttribute('aria-label','Agrandir les photos de '+product.name);open.append(image);open.addEventListener('click',()=>enlarge(photos,product.name,selected,open));visual.append(open);
   if(photos.length>1){
    const prev=el('button','product-prev','←'),next=el('button','product-next','→'),counter=el('span','product-counter');prev.type=next.type='button';prev.setAttribute('aria-label','Photo précédente de '+product.name);next.setAttribute('aria-label','Photo suivante de '+product.name);counter.setAttribute('aria-live','polite');
    thumbnails=el('div','product-thumbnails');thumbnails.setAttribute('role','group');thumbnails.setAttribute('aria-label','Photos de '+product.name);
    const buttons=[];const show=index=>{selected=(index+photos.length)%photos.length;image.src=photos[selected].src;image.alt=photos[selected].alt||product.name;counter.textContent=(selected+1)+' / '+photos.length;buttons.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===selected)));};
    photos.forEach((photo,index)=>{const thumb=el('button','product-thumbnail');thumb.type='button';thumb.setAttribute('aria-label','Photo '+(index+1)+' de '+product.name);const thumbImage=el('img');thumbImage.src=photo.src;thumbImage.alt='';thumbImage.loading='lazy';thumb.append(thumbImage);thumb.addEventListener('click',()=>show(index));buttons.push(thumb);thumbnails.append(thumb);});
    prev.addEventListener('click',()=>show(selected-1));next.addEventListener('click',()=>show(selected+1));visual.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();show(selected+(event.key==='ArrowLeft'?-1:1));}});visual.append(prev,next,counter);show(0);
   }
  }else visual.append(image);
  if(!imageUrl)visual.append(el('span','','VISUEL À VENIR'));
  card.append(visual);if(thumbnails)card.append(thumbnails);
  const meta=el('div','product-meta');if(product.category)meta.append(el('span','product-category',product.category));if(product.price)meta.append(el('span','product-price',product.price));card.append(meta,el('h2','',product.name));
  if(product.description)card.append(el('p','product-description',product.description));
  if(product.sizes?.length)card.append(el('p','product-sizes','Tailles : '+product.sizes.join(' / ')));
  const orderUrl=product.orderUrl&&safeUrl(product.orderUrl);
  if(product.available===false)card.append(el('p','product-sizes','Indisponible')); if(orderUrl&&product.available!==false){const link=el('a','pill light','Commander ↗');link.href=orderUrl;link.target='_blank';link.rel='noopener noreferrer';card.append(link)}
  grid.append(card);
 }
}
const albumsRoot=document.getElementById('gallery-albums');
if(!albumsRoot)return;
const albums=(Array.isArray(data.albums)?data.albums:[]).filter(album=>album.published!==false).slice().sort((a,b)=>(b.date||b.dateLabel||'').localeCompare(a.date||a.dateLabel||''));
const filter=document.getElementById('album-filter');
const viewer=document.getElementById('photo-viewer'),viewerImage=document.getElementById('viewer-image');
let currentPhotos=[],currentIndex=0,lastTrigger=null;
function displayPhoto(){const p=currentPhotos[currentIndex];viewerImage.src=p.src;viewerImage.alt=p.alt||'';document.getElementById('viewer-caption').textContent=p.caption||p.alt||'';document.getElementById('viewer-counter').textContent=(currentIndex+1)+' / '+currentPhotos.length;const single=currentPhotos.length<2;document.getElementById('viewer-prev').hidden=single;document.getElementById('viewer-next').hidden=single}
function step(delta){if(currentPhotos.length){currentIndex=(currentIndex+delta+currentPhotos.length)%currentPhotos.length;displayPhoto()}}
albums.forEach((album,index)=>{
 const photos=(album.photos||[]).filter(p=>p.src&&safeUrl(p.src));
 
 const section=el('section','photo-album');section.id='album-'+index;
 const heading=el('div','album-heading'),text=el('div');
 if(album.date){const date=el('time','album-date',new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long',year:'numeric'}).format(new Date(album.date+'T12:00:00')));date.dateTime=album.date;text.append(date)}else if(album.dateLabel){text.append(el('p','album-date',album.dateLabel))}
 const h=el('h2','',album.title);h.id='album-title-'+index;section.setAttribute('aria-labelledby',h.id);text.append(h);
 if(album.preview)text.append(el('p','album-subtitle','Sélection de prévisualisation — dates et événements à renseigner.'));
 else if(album.location)text.append(el('p','album-subtitle',album.location));
 heading.append(text,el('span','album-count',photos.length?photos.length+' photo'+(photos.length>1?'s':''):'Photos à venir'));section.append(heading);
 const mosaic=el('div','photo-mosaic');
 if(!photos.length){mosaic.classList.add('mosaic-empty');for(let i=0;i<3;i++){const placeholder=el('div','empty-photo');placeholder.setAttribute('aria-hidden','true');mosaic.append(placeholder)}const message=el('p','empty-album-message','Les photos arrivent bientôt.');mosaic.append(message)}
 photos.forEach((photo,photoIndex)=>{const button=el('button','gallery-photo');button.type='button';button.setAttribute('aria-label','Agrandir : '+(photo.alt||album.title));const img=el('img');img.src=photo.src;img.alt=photo.alt||'';img.loading='lazy';button.append(img);const icon=el('span','photo-expand','↗');icon.setAttribute('aria-hidden','true');button.append(icon);button.addEventListener('click',()=>{currentPhotos=photos;currentIndex=photoIndex;lastTrigger=button;document.getElementById('viewer-album').textContent=album.title;displayPhoto();viewer.showModal()});mosaic.append(button)});
 section.append(mosaic);albumsRoot.append(section);const option=el('option','',album.title);option.value=section.id;filter.append(option);
});
document.getElementById('album-tools').hidden=filter.options.length<3;
filter.addEventListener('change',()=>{for(const section of albumsRoot.children)section.hidden=filter.value!=='all'&&section.id!==filter.value});
document.getElementById('viewer-close').addEventListener('click',()=>viewer.close());
document.getElementById('viewer-prev').addEventListener('click',()=>step(-1));
document.getElementById('viewer-next').addEventListener('click',()=>step(1));
viewer.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'){event.preventDefault();step(-1)}if(event.key==='ArrowRight'){event.preventDefault();step(1)}});
viewer.addEventListener('click',event=>{if(event.target===viewer)viewer.close()});
viewer.addEventListener('close',()=>{viewerImage.removeAttribute('src');lastTrigger?.focus()});
})();
