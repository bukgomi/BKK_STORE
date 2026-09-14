const fs=require("fs"),path=require("path");
const UA="topcasting-rigs/1.0 (bkk.noname.admin@gmail.com)";
const BAD=/sushi|nigiri|dried|sashimi|food|dish|cooked|grilled|fried|market|plate|meal|干|寿司|刺身/i;
const TARGETS={
  "우럭":[["Sebastes schlegelii","Sebastes"],["Schlegel's black rockfish","rockfish"],["Sebastes schlegeli","Sebastes"]],
  "한치":[["Uroteuthis edulis","Uroteuthis"],["Photololigo edulis","edulis"],["swordtip squid","squid"],["Uroteuthis duvaucelii","Uroteuthis"],["Loligo edulis","Loligo"]],
  "호래기":[["Loliolus beka","Loliolus"],["Loliolus","Loliolus"],["Loliolus japonica live","Loliolus"],["Loligo beka","beka"],["Loliginidae small squid","Loligin"]],
};
async function search(term){const url=`https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=15&gsrsearch=${encodeURIComponent(term+" filetype:bitmap")}&prop=imageinfo&iiprop=url|extmetadata|mime|size&iiurlwidth=800`;const j=await (await fetch(url,{headers:{"User-Agent":UA}})).json();return Object.values(j.query?.pages||{}).map(p=>{const ii=p.imageinfo?.[0];if(!ii)return null;const m=ii.extmetadata||{};return{title:p.title,thumb:ii.thumburl,url:ii.descriptionurl,license:m.LicenseShortName?.value||"",artist:(m.Artist?.value||"").replace(/<[^>]+>/g,"").trim(),w:ii.width,h:ii.height,mime:ii.mime}}).filter(Boolean).filter(x=>/jpeg|png/.test(x.mime)&&x.w>=400&&/CC|Public domain|CC0/i.test(x.license));}
(async()=>{const credits=JSON.parse(fs.readFileSync("public/uploads/rigs/species/credits.json","utf8"));
for(const [ko,terms] of Object.entries(TARGETS)){let hit=null;
  for(const [t,must] of terms){const res=(await search(t)).filter(r=>!BAD.test(r.title)&&new RegExp(must,"i").test(r.title));console.log(`  ${ko} "${t}" → ${res.length}건`, res.slice(0,3).map(r=>r.title.slice(5,50)).join(" | "));if(res.length){hit=res.find(r=>r.w>=r.h)||res[0];break;}}
  if(!hit){console.log("✗",ko,"대체 없음");continue;}
  const buf=Buffer.from(await (await fetch(hit.thumb,{headers:{"User-Agent":UA}})).arrayBuffer());fs.writeFileSync(path.join("public/uploads/rigs/species",`${ko}.jpg`),buf);
  credits[ko]={path:`/uploads/rigs/species/${ko}.jpg`,source:hit.url,title:hit.title.replace(/^File:/,""),artist:hit.artist,license:hit.license};console.log("✔",ko,"←",hit.title.slice(5,70),"|",hit.license);}
fs.writeFileSync("public/uploads/rigs/species/credits.json",JSON.stringify(credits,null,2));})();
