(() => {
const data=window.HANOMALIA_COLLECTIONS||{merch:[],albums:[]};
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node};
const safeUrl=(value)=>{try{const u=new URL(value,location.href);return ['http:','https:'].includes(u.protocol)?u.href:null}catch{return null}};
const grid=document.getElementById('merch-grid');
if(grid){
 const products=Array.isArray(data.merch)?data.merch:[];
 document.getElementById('merch-note').hidden=products.length>0;
 const entries=products.length?products:[1,2,3].map(i=>({name:'Article '+String(i).padStart(2,'0'),category:'À venir',description:'Nom, prix et tailles à renseigner.',placeholder:true,index:i}));
 for(const product of entries){
  const card=el('article','product-card');
  const imageUrl=product.image&&safeUrl(product.image);
  const visual=el('div',imageUrl?'product-image':'product-placeholder');
  const image=el('img');image.src=imageUrl||(product.index===2?'assets/skull-original.png':'assets/logo-horizontal-blanc.png');image.alt=imageUrl?product.name:'';image.loading='lazy';visual.append(image);
  if(!imageUrl)visual.append(el('span','','VISUEL À VENIR'));
  const meta=el('div','product-meta');if(product.category)meta.append(el('span','product-category',product.category));if(product.price)meta.append(el('span','product-price',product.price));card.append(visual,meta,el('h2','',product.name));
  if(product.description)card.append(el('p','product-description',product.description));
  if(product.sizes?.length)card.append(el('p','product-sizes','Tailles : '+product.sizes.join(' / ')));
  const orderUrl=product.orderUrl&&safeUrl(product.orderUrl);
  if(orderUrl){const link=el('a','pill light','Commander ↗');link.href=orderUrl;link.target='_blank';link.rel='noopener noreferrer';card.append(link)}
  grid.append(card);
 }
}
const albumsRoot=document.getElementById('gallery-albums');
if(!albumsRoot)return;
const albums=(Array.isArray(data.albums)?data.albums:[]).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
const filter=document.getElementById('album-filter');
const viewer=document.getElementById('photo-viewer'),viewerImage=document.getElementById('viewer-image');
let currentPhotos=[],currentIndex=0,lastTrigger=null;
function displayPhoto(){const p=currentPhotos[currentIndex];viewerImage.src=p.src;viewerImage.alt=p.alt||'';document.getElementById('viewer-caption').textContent=p.caption||p.alt||'';document.getElementById('viewer-counter').textContent=(currentIndex+1)+' / '+currentPhotos.length;const single=currentPhotos.length<2;document.getElementById('viewer-prev').hidden=single;document.getElementById('viewer-next').hidden=single}
function step(delta){if(currentPhotos.length){currentIndex=(currentIndex+delta+currentPhotos.length)%currentPhotos.length;displayPhoto()}}
albums.forEach((album,index)=>{
 const photos=(album.photos||[]).filter(p=>p.src&&safeUrl(p.src));
 if(!photos.length)return;
 const section=el('section','photo-album');section.id='album-'+index;
 const heading=el('div','album-heading'),text=el('div');
 if(album.date){const date=el('time','album-date',new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long',year:'numeric'}).format(new Date(album.date+'T12:00:00')));date.dateTime=album.date;text.append(date)}
 const h=el('h2','',album.title);h.id='album-title-'+index;section.setAttribute('aria-labelledby',h.id);text.append(h);
 if(album.preview)text.append(el('p','album-subtitle','Sélection de prévisualisation — dates et événements à renseigner.'));
 else if(album.location)text.append(el('p','album-subtitle',album.location));
 heading.append(text,el('span','album-count',photos.length+' photo'+(photos.length>1?'s':'')));section.append(heading);
 const mosaic=el('div','photo-mosaic');
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