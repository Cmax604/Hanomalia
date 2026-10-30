import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {validateDocument,publishDocument,encodeText,decodeText,referencedUploads,safeLink,safeImage,listVersions} from '../admin/core.mjs';
import {readVersion} from '../admin/versions.mjs';
const current=JSON.parse(fs.readFileSync(fileURLToPath(new URL('../content/site.json',import.meta.url)),'utf8'));
const original=structuredClone(current);
original.collections={merch:[{name:'Article test',price:'20 €',image:null,sizes:[]}],albums:[{title:'Événement test',date:'2026-06-21',photos:[{src:'assets/example.webp',alt:'Photo de test'}]}]};
const clone=()=>structuredClone(original);
test('current published content remains a valid editable document',()=>{
 const doc=validateDocument(current);assert.equal(Object.keys(doc.pages).length,6);assert(Array.isArray(doc.collections.merch));assert(Array.isArray(doc.collections.albums));
 for(const page of Object.values(doc.pages))assert(page.fields.some(f=>f.type==='text'));
});
test('rejects script links, unsafe image paths and impossible calendar dates',()=>{
 assert.equal(safeLink('javascript:alert(1)'),false);assert.equal(safeImage('assets/../admin/file.html'),false);assert.equal(safeImage('data:image/svg+xml;base64,PHN2Zz4='),false);
 const doc=clone();doc.collections.albums[0].date='2026-02-30';assert.throws(()=>validateDocument(doc),/Date invalide/);
 const doc2=clone();doc2.pages['index.html'].fields.find(f=>f.type==='url').value='javascript:alert(1)';assert.throws(()=>validateDocument(doc2),/Lien invalide/);
});
test('Unicode survives GitHub encoding',()=>{const text='Fête de la musique · 20 € · Écouter 🎸';assert.equal(decodeText(encodeText(text)),text);});
function fakeApi({contentSha='base-content',refFailure=false}={}){
 const calls=[];return {calls,api:async(path,options={})=>{
 calls.push({path,...options});
 if(path==='/git/ref/heads/main')return {object:{sha:'head-1'}};
 if(path==='/contents/content/site.json?ref=head-1')return {sha:contentSha};
 if(path==='/git/commits/head-1')return {tree:{sha:'tree-1'}};
 if(path==='/git/blobs')return {sha:options.body.encoding==='base64'?'photo-blob':'document-blob'};
 if(path==='/git/trees')return {sha:'tree-2'};
 if(path==='/git/commits')return {sha:'commit-2'};
 if(path==='/git/refs/heads/main'){if(refFailure)throw Error('Not a fast forward');return {};}
 throw Error('Unexpected API request: '+path);
 }};
}
test('publishes media and content in one tree/commit, without forced updates',async()=>{
 const doc=clone();doc.collections.merch[0].image='assets/uploads/123-test.webp';const before=JSON.stringify(doc);const fake=fakeApi();
 const result=await publishDocument({api:fake.api,document:doc,uploads:[{path:'assets/uploads/123-test.webp',base64:'YWJj'},{path:'assets/uploads/unused-test.webp',base64:'YWJj'}],baselineSha:'base-content'});
 assert.equal(result.contentSha,'document-blob');assert.equal(fake.calls.filter(c=>c.path==='/git/blobs').length,2);
 const tree=fake.calls.find(c=>c.path==='/git/trees').body;assert.deepEqual(tree.tree.map(e=>e.path),['assets/uploads/123-test.webp','content/site.json']);
 assert.equal(tree.base_tree,'tree-1');assert.deepEqual(fake.calls.find(c=>c.path==='/git/commits').body.parents,['head-1']);assert.equal(fake.calls.at(-1).body.force,false);assert.equal(JSON.stringify(doc),before);
});
test('refuses changed content before uploading any new media',async()=>{
 const fake=fakeApi({contentSha:'someone-else-content'});await assert.rejects(()=>publishDocument({api:fake.api,document:clone(),uploads:[],baselineSha:'base-content'}),/contenu a changé/);
 assert.equal(fake.calls.filter(c=>c.method==='POST'||c.method==='PATCH').length,0);
});
test('late concurrent update is not forced and keeps the draft intact',async()=>{
 const fake=fakeApi({refFailure:true});const doc=clone(),before=JSON.stringify(doc);await assert.rejects(()=>publishDocument({api:fake.api,document:doc,uploads:[],baselineSha:'base-content'}),/Not a fast forward/);assert.equal(JSON.stringify(doc),before);assert.equal(fake.calls.at(-1).body.force,false);
});
test('upload reference discovery includes field photos, product photos and album photos',()=>{
 const doc=clone();doc.pages['membres.html'].fields.find(f=>f.type==='image').value='assets/uploads/one.webp';doc.collections.merch[0].image='assets/uploads/two.webp';doc.collections.albums[0].photos[0].src='assets/uploads/three.webp';assert.deepEqual([...referencedUploads(doc)].sort(),['assets/uploads/one.webp','assets/uploads/three.webp','assets/uploads/two.webp']);
});
test('version history follows pagination and keeps commit identity',async()=>{
 const entry=i=>({sha:String(i).padStart(40,'a'),commit:{message:'Version '+i+'\nDetails',author:{name:'Test',date:'2026-10-30T12:00:00Z'}},html_url:'https://github.com/example'});
 const calls=[];const versions=await listVersions(async url=>{calls.push(url);return url.endsWith('page=1')?Array.from({length:100},(_,i)=>entry(i)):[entry(100)];});
 assert.equal(calls.length,2);assert.equal(versions.length,101);assert.equal(versions[0].number,101);assert.equal(versions.at(-1).number,1);assert.equal(versions[0].title,'Version 0');
});
test('loading an old version changes no remote file and preserves current conflict baseline',async()=>{
 const sha='a'.repeat(40),calls=[];const historical=clone();historical.collections.merch[0].price='15 €';
 const result=await readVersion(async path=>{calls.push(path);if(path.includes('/git/ref/'))return {object:{sha:'current-head'}};return path.endsWith(sha)?{content:encodeText(JSON.stringify(historical))}:{sha:'current-content'};},sha);
 assert.equal(result.document.collections.merch[0].price,'15 €');assert.equal(result.baselineSha,'current-content');assert.equal(result.expectedHead,'current-head');assert.equal(result.legacy,false);assert(calls.every(p=>!p.includes('/git/commits')));
});
test('pre-administration versions can be loaded for full source restoration',async()=>{
 const result=await readVersion(async path=>{if(path.includes('/git/ref/'))return {object:{sha:'current'}};if(path.endsWith('a'.repeat(40))){const error=Error('missing');error.status=404;throw error;}return {sha:'current-content',content:encodeText(JSON.stringify(clone()))};},'a'.repeat(40));assert.equal(result.legacy,true);
});
test('restoration uses the historical source tree, preserves administration, and makes a new commit',async()=>{
 const fake=fakeApi();const calls=fake.calls;
 const result=await publishDocument({api:async(path,options)=>{
 if(path==='/git/commits/'+'a'.repeat(40)){calls.push({path});return {tree:{sha:'historical-tree'}};}
 if(path==='/git/trees/tree-1'){calls.push({path});return {tree:[{path:'admin',mode:'040000',type:'tree',sha:'current-admin'},{path:'.github',mode:'040000',type:'tree',sha:'current-workflow'},{path:'styles.css',mode:'100644',type:'blob',sha:'current-style'}]};}
 return fake.api(path,options);
 },document:clone(),uploads:[],baselineSha:'base-content',restoreCommit:'a'.repeat(40),expectedHead:'head-1'});
 const tree=calls.find(c=>c.path==='/git/trees').body;assert.equal(tree.base_tree,'historical-tree');assert(tree.tree.some(e=>e.sha==='current-admin'));assert(!tree.tree.some(e=>e.path==='styles.css'));assert.deepEqual(calls.find(c=>c.path==='/git/commits').body.parents,['head-1']);assert.equal(calls.at(-1).body.force,false);assert.equal(result.commit,'commit-2');
});
test('a changed source head blocks restoration even if content did not change',async()=>{
 const fake=fakeApi();await assert.rejects(()=>publishDocument({api:fake.api,document:clone(),uploads:[],baselineSha:'base-content',restoreCommit:'a'.repeat(40),expectedHead:'older-head'}),/version GitHub a changé/);assert.equal(fake.calls.length,1);
});
