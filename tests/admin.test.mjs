import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {validateDocument,publishDocument,encodeText,decodeText,referencedUploads,safeLink,safeImage} from '../admin/core.mjs';
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
