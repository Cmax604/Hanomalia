import {CONTENT_PATH,decodeText,validateDocument,listVersions} from './core.mjs';

export async function readVersion(api,sha){
 if(!/^[a-f0-9]{40}$/.test(sha))throw Error('Version invalide.');
 const ref=await api('/git/ref/heads/main');
 const current=await api('/contents/'+CONTENT_PATH+'?ref='+ref.object.sha);
 try{
  const file=await api('/contents/'+CONTENT_PATH+'?ref='+sha);
  return {document:validateDocument(JSON.parse(decodeText(file.content))),baselineSha:current.sha,restoreCommit:sha,expectedHead:ref.object.sha,legacy:false};
 }catch(e){
  if(e.status!==404)throw e;
  return {document:validateDocument(JSON.parse(decodeText(current.content))),baselineSha:current.sha,restoreCommit:sha,expectedHead:ref.object.sha,legacy:true};
 }
}

export async function fetchHistory(api){
 const response=await fetch('../versions.json',{cache:'no-store'});
 if(response.ok){const manifest=await response.json();if(Array.isArray(manifest.versions)&&manifest.versions.length)return manifest;}
 const versions=await listVersions(api);return {current:null,versions};
}
