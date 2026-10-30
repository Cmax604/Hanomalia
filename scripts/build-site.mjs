import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {validateDocument} from '../admin/core.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const document=validateDocument(JSON.parse(fs.readFileSync(path.join(root,'content/site.json'),'utf8')));
const data='window.HANOMALIA_SITE = '+JSON.stringify(document).replace(/</g,'\\u003c')+';\n';
fs.writeFileSync(path.join(root,'site-data.js'),data);
if(process.argv.includes('--data-only'))process.exit(0);
const output=path.join(root,'_site');fs.mkdirSync(output,{recursive:true});
for(const name of ['index.html','groupe.html','membres.html','live.html','merch.html','galerie.html','styles.css','membres.css','collections.css','collections.js','collections-data.js','script.js','site-data.js','site-render.js','.nojekyll'])fs.copyFileSync(path.join(root,name),path.join(output,name));
for(const name of ['assets','admin','content'])fs.cpSync(path.join(root,name),path.join(output,name),{recursive:true});
const hash=file=>createHash('sha256').update(fs.readFileSync(path.join(output,file))).digest('hex').slice(0,12);
for(const name of ['index.html','groupe.html','membres.html','live.html','merch.html','galerie.html']){
 let html=fs.readFileSync(path.join(output,name),'utf8');
 html=html.replace(/((?:src|href)=")([^"?]+\.(?:js|css))(?:\?[^\"]*)?"/g,(whole,prefix,file)=>fs.existsSync(path.join(output,file))?prefix+file+'?v='+hash(file)+'"':whole);
 fs.writeFileSync(path.join(output,name),html);
}
const moduleFile=path.join(output,'admin/admin.mjs');
fs.writeFileSync(moduleFile,fs.readFileSync(moduleFile,'utf8').replace("'./core.mjs'","'./core.mjs?v="+hash('admin/core.mjs')+"'"));
for(const name of ['admin/index.html','admin/guide.html']){
 let html=fs.readFileSync(path.join(output,name),'utf8');
 html=html.replace(/((?:src|href)=")(admin\.(?:mjs|css))"/g,(whole,prefix,file)=>prefix+file+'?v='+hash('admin/'+file)+'"');
 fs.writeFileSync(path.join(output,name),html);
}
console.log('Site validé et préparé dans _site');
