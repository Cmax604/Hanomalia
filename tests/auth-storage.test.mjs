import test from 'node:test';
import assert from 'node:assert/strict';
import {credentialStore,AUTH_STORAGE_KEY} from '../admin/auth-storage.mjs';
function storage(){const entries=new Map();return {entries,getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)};}
test('remembered connection survives a fresh controller and forgetting preserves drafts',()=>{
 const local=storage();local.setItem('draft','site content');
 const first=credentialStore(local);assert.equal(first.read(),'');first.save('  example-test-value  ');
 const reopened=credentialStore(local);assert.equal(reopened.read(),'example-test-value');reopened.forget();assert.equal(first.read(),'');assert.equal(local.getItem('draft'),'site content');assert(!local.entries.has(AUTH_STORAGE_KEY));
});
test('unavailable storage does not block session login or logout and reports failed persistence',()=>{
 const blocked=credentialStore({getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}});
 assert.equal(blocked.read(),'');assert.doesNotThrow(()=>blocked.forget());assert.throws(()=>blocked.save('example-test-value'),/blocked/);
});
test('blank or corrupt entries are never treated as a remembered key',()=>{
 const local=storage(),saved=credentialStore(local);assert.throws(()=>saved.save(' '),/invalide/);local.setItem(AUTH_STORAGE_KEY,'x'.repeat(1000));assert.equal(saved.read(),'');
});
