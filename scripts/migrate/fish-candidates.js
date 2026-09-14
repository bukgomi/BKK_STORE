const fs=require("fs"),path=require("path");const UA="topcasting-rigs/1.0 (bkk.noname.admin@gmail.com)";
const SP={
 "갑오징어":["Sepia esculenta","Sepia officinalis"],"쭈꾸미":["Amphioctopus fangsiao","Octopus ocellatus"],"문어":["Octopus vulgaris","Enteroctopus dofleini"],
 "광어":["Paralichthys olivaceus"],"우럭":["Sebastes schlegelii"],"갈치":["Trichiurus lepturus"],"무늬오징어":["Sepioteuthis lessoniana"],
 "한치":["Uroteuthis edulis","Loligo vulgaris"],"호래기":["Loliolus japonica","Loligo"],"참돔":["Pagrus major"],"농어":["Lateolabrax japonicus"],
 "삼치":["Scomberomorus niphonius","Scomberomorus"],"부시리":["Seriola lalandi","Seriola quinqueradiata"],"대구":["Gadus macrocephalus"],
 "볼락":["Sebastes inermis"],"전갱이":["Trachurus japonicus"],"배스":["Micropterus salmoides"],"쏘가리":["Siniperca scherzeri"],
 "송어":["Oncorhynchus mykiss"],"감성돔":["Acanthopagrus schlegelii"]};
const BAD=/sushi|nigiri|dried|sashimi|food|dish|cooked|grilled|fried|market|meal|skelet|otolith|gladius|hectocotylus|egg|larva|paralarva|map|range|distribution|fossil|logo|stamp|coin|statue|toy|graph|chart|shell|beak|tooth|jaw|scale/i;
const CLEAN=/illustr|drawing|plate|FMIB|Fishes of|NOAA|FAO|white background|cutout|isolated|Bloch|Jordan|Temminck|Fauna Japonica|painting|Iconograph|lithograph/i;
async function q(term){const url=`https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=25&gsrsearch=${encodeURIComponent(term)}&prop=imageinfo&iiprop=url|extmetadata|mime|size&iiurlwidth=600`;const j=await (await fetch(url,{headers:{"User-Agent":UA}})).json();return Object.values(j.query?.pages||{}).map(p=>{const ii=p.imageinfo?.[0];if(!ii)return null;const m=ii.extmetadata||{};return{title:p.title.replace(/^File:/,""),thumb:ii.thumburl,desc:ii.descriptionurl,license:m.LicenseShortName?.value||"",artist:(m.Artist?.value||"").replace(/<[^>]+>/g,"").trim(),w:ii.width,h:ii.height,mime:ii.mime}}).filter(Boolean).filter(x=>/jpeg|png/.test(x.mime)&&x.w>=400&&/CC|Public domain|CC0/i.test(x.license)&&!BAD.test(x.title));}
(async()=>{const all={};
for(const [ko,terms] of Object.entries(SP)){let cands=[];for(const t of terms){cands.push(...await q(t+" illustration"));cands.push(...await q(t));}
 const seen=new Set();cands=cands.filter(c=>!seen.has(c.title)&&seen.add(c.title));
 cands.sort((a,b)=>(CLEAN.test(b.title)?1:0)-(CLEAN.test(a.title)?1:0));cands=cands.slice(0,5);
 for(let i=0;i<cands.length;i++){try{const buf=Buffer.from(await (await fetch(cands[i].thumb,{headers:{"User-Agent":UA}})).arrayBuffer());fs.writeFileSync(`scripts/migrate/out/fish-candidates/${ko}-${i+1}.jpg`,buf);}catch{}}
 all[ko]=cands;console.log(ko, cands.map((c,i)=>`${i+1}:${c.title.slice(0,38)}[${c.license.slice(0,10)}]`).join(" | "));await new Promise(r=>setTimeout(r,300));}
fs.writeFileSync("scripts/migrate/out/fish-candidates.json",JSON.stringify(all,null,1));})();
