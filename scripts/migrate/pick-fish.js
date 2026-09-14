const fs=require("fs");const UA="topcasting-rigs/1.0 (bkk.noname.admin@gmail.com)";
const PICK={"갑오징어":3,"쭈꾸미":5,"문어":2,"광어":1,"우럭":2,"갈치":2,"무늬오징어":2,"한치":2,"호래기":5,"참돔":1,"농어":1,"삼치":2,"부시리":1,"대구":2,"볼락":1,"전갱이":1,"배스":3,"쏘가리":1,"송어":2,"감성돔":1};
(async()=>{const all=JSON.parse(fs.readFileSync("scripts/migrate/out/fish-candidates.json","utf8"));const credits={};
for(const [ko,n] of Object.entries(PICK)){const c=all[ko][n-1];if(!c){console.log("✗",ko);continue;}
 const big=c.thumb.replace(/\/\d+px-/,"/1000px-");
 let buf;try{buf=Buffer.from(await (await fetch(big,{headers:{"User-Agent":UA}})).arrayBuffer());if(buf.length<5000)throw 0;}catch{buf=Buffer.from(await (await fetch(c.thumb,{headers:{"User-Agent":UA}})).arrayBuffer());}
 fs.writeFileSync(`scripts/migrate/out/fish-candidates/pick-${ko}.jpg`,buf);
 credits[ko]={path:`/uploads/rigs/species/${ko}.jpg`,source:c.desc,title:c.title,artist:c.artist,license:c.license,...(["한치","호래기"].includes(ko)?{note:"유사 어종 그림"}:{})};
 console.log("✔",ko,"←",c.title.slice(0,60),"|",c.license);await new Promise(r=>setTimeout(r,250));}
fs.writeFileSync("public/uploads/rigs/species/credits.json",JSON.stringify(credits,null,2));})();
