// Separate from drafts, exports, previews and site content. Never sent elsewhere.
export const AUTH_STORAGE_KEY='hanomalia-v2-admin-github-key-v1';
export function credentialStore(storage){
 return {
  read(){try{const value=storage.getItem(AUTH_STORAGE_KEY);return typeof value==='string'&&value.trim().length>0&&value.length<1000?value.trim():'';}catch{return ''; }},
  save(value){if(typeof value!=='string'||!value.trim()||value.length>=1000)throw Error('Clé invalide.');storage.setItem(AUTH_STORAGE_KEY,value.trim());},
  forget(){try{storage.removeItem(AUTH_STORAGE_KEY);}catch{/* Storage may be disabled; session disconnection still works. */}}
 };
}
