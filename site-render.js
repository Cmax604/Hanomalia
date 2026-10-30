(() => {
  let content=window.HANOMALIA_SITE;
  const preview=new URLSearchParams(location.search).get('cms-preview')==='1'&&window.parent!==window;
  if(preview){try{const draft=JSON.parse(sessionStorage.getItem('hanomalia-preview'));if(draft?.version===1)content=draft;}catch{}}
  if(!content)return;
  const pageName=location.pathname.split('/').pop()||'index.html';
  const page=content.pages?.[pageName];
  const fields=new Map((page?.fields||[]).map(field=>[field.id,field]));
  const imageAllowed=value=>typeof value==='string'&&((/^assets\//.test(value)&&!value.split('/').includes('..'))||/^https:\/\//.test(value)||(preview&&value.startsWith('blob:'+location.origin+'/')));
  document.querySelectorAll('[data-cms-text]').forEach(node=>{const field=fields.get(node.dataset.cmsText);if(field?.type==='text')node.textContent=field.value;});
  document.querySelectorAll('[data-cms-image]').forEach(node=>{const field=fields.get(node.dataset.cmsImage);if(field?.type==='image'&&imageAllowed(field.value)){node.src=field.value;if(typeof field.alt==='string')node.alt=field.alt;}});
  document.querySelectorAll('[data-cms-url]').forEach(node=>{const field=fields.get(node.dataset.cmsUrl);if(field?.type!=='url')return;try{const url=new URL(field.value,location.href);if(['https:','http:','mailto:'].includes(url.protocol))node.href=field.value;}catch{}});
  for(const [id,property] of [['theme-smoke','--cms-smoke'],['theme-shadow','--cms-shadow']]){const field=content.pages?.['index.html']?.fields.find(f=>f.id===id);if(field&&imageAllowed(field.value))document.documentElement.style.setProperty(property,'url('+JSON.stringify(field.value)+')');}
  window.HANOMALIA_SITE=content;
  window.HANOMALIA_COLLECTIONS=content.collections;
  if(preview){const badge=document.createElement('div');badge.textContent='Aperçu du brouillon · non publié';badge.style.cssText='position:fixed;bottom:12px;left:12px;background:#6e1121;color:white;padding:8px 16px;border-radius:20px;font:12px Arial;z-index:100;pointer-events:none';document.body.append(badge);}
})();
