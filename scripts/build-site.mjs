import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {validateDocument} from '../admin/core.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const document=validateDocument(JSON.parse(fs.readFileSync(path.join(root,'content/site.json'),'utf8')));
const data='window.HANOMALIA_SITE = '+JSON.stringify(document).replace(/</g,'\\u003c')+';\n';
fs.writeFileSync(path.join(root,'site-data.js'),data);
if(process.argv.includes('--data-only'))process.exit(0);
const output=path.join(root,'_site');fs.mkdirSync(output,{recursive:true});
const history=execFileSync('git',['log','--first-parent','--format=%H%x09%cI%x09%an%x09%s','HEAD'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);
fs.writeFileSync(path.join(output,'versions.json'),JSON.stringify({current:history[0]?.split('\t')[0],versions:history.map((line,index)=>{const [sha,date,author,...title]=line.split('\t');return {sha,date,author,title:title.join('\t'),number:history.length-index,url:'https://github.com/Cmax604/Hanomalia/commit/'+sha};})},null,2));
for(const name of ['index.html','groupe.html','membres.html','live.html','merch.html','galerie.html','styles.css','membres.css','collections.css','collections.js','collections-data.js','script.js','site-data.js','site-render.js','.nojekyll'])if(fs.existsSync(path.join(root,name)))fs.copyFileSync(path.join(root,name),path.join(output,name));
for(const name of ['assets','admin','content'])if(fs.existsSync(path.join(root,name)))fs.cpSync(path.join(root,name),path.join(output,name),{recursive:true});
const hash=file=>createHash('sha256').update(fs.readFileSync(path.join(output,file))).digest('hex').slice(0,12);
for(const name of ['index.html','groupe.html','membres.html','live.html','merch.html','galerie.html']){
 if(!fs.existsSync(path.join(output,name)))continue;
 let html=fs.readFileSync(path.join(output,name),'utf8');
 html=html.replace(/((?:src|href)=")([^"?]+\.(?:js|css))(?:\?[^\"]*)?"/g,(whole,prefix,file)=>fs.existsSync(path.join(output,file))?prefix+file+'?v='+hash(file)+'"':whole);
 fs.writeFileSync(path.join(output,name),html);
}
for(const module of ['admin/versions.mjs','admin/admin.mjs']){const moduleFile=path.join(output,module);fs.writeFileSync(moduleFile,fs.readFileSync(moduleFile,'utf8').replaceAll("'./core.mjs'","'./core.mjs?v="+hash('admin/core.mjs')+"'").replaceAll("'./versions.mjs'","'./versions.mjs?v="+hash('admin/versions.mjs')+"'"));}
for(const name of ['admin/index.html','admin/guide.html']){
 let html=fs.readFileSync(path.join(output,name),'utf8');
 html=html.replace(/((?:src|href)=")(admin\.(?:mjs|css))"/g,(whole,prefix,file)=>prefix+file+'?v='+hash('admin/'+file)+'"');
 fs.writeFileSync(path.join(output,name),html);
}
console.log('Site validé et préparé dans _site');
