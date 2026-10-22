// SIMULAB: public Google News RSS headline discovery, not full article analysis.
// Free and best effort; terms and access can change. Never cache user input unboundedly.
const decodeXML = s => String(s||"")
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1")
  .replace(/<[^>]*>/g,"")
  .replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&apos;/g,"'")
  .replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">")
  .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Math.min(Number(n),0x10ffff)))
  .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(Math.min(parseInt(n,16),0x10ffff))).trim();
const extract=(item,tag)=>decodeXML((item.match(new RegExp("<"+tag+"(?:\\s[^>]*)?>([\\s\\S]*?)<\\/"+tag+">","i"))||[])[1]||"");
export default async function handler(req,res){
  if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});
  const team=typeof req.query.team==="string"?req.query.team.trim().slice(0,85):"";
  if(!team||!/[a-zA-ZÀ-ž]/.test(team))return res.status(400).json({error:"Geçerli takım gerekli"});
  const clean=team.replace(/["'<>]/g,"").replace(/\s+/g," ").trim();
  const phrase='"'+clean+'" football (injury OR lineup OR manager OR coach OR suspension OR form OR training)';
  const url="https://news.google.com/rss/search?"+new URLSearchParams({q:phrase,hl:"en-GB",gl:"GB",ceid:"GB:en"}).toString();
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),10000);
  try{
    const response=await fetch(url,{signal:controller.signal,headers:{"User-Agent":"Mozilla/5.0 (compatible; SimulabFootball/2.0; news-feed-viewer)","Accept":"application/rss+xml, application/xml, text/xml"}});
    if(!response.ok)throw Error("RSS HTTP "+response.status);
    const xml=await response.text();
    if(!xml.includes("<rss")&&!xml.includes("<item>"))throw Error("Beklenmeyen RSS yanıtı");
    const items=[...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0,30).map(m=>{
      const b=m[1],title=extract(b,"title"),link=extract(b,"link"),published=extract(b,"pubDate"),source=extract(b,"source");
      const date=new Date(published);
      return {title:title.slice(0,280),url:link.startsWith("https://")?link:"",published:Number.isNaN(date.getTime())?null:date.toISOString(),source:source.slice(0,80)};
    }).filter(x=>x.title&&x.url).slice(0,12);
    res.setHeader("Cache-Control","public, s-maxage=900, stale-while-revalidate=1800");
    return res.status(200).json({team:clean,provider:"Google News RSS",scope:"headlines-only",fetchedAt:new Date().toISOString(),items});
  }catch(e){
    return res.status(502).json({error:"Haber akışına ulaşılamadı. Daha sonra yeniden deneyebilirsiniz.",detail:String(e.message||e).slice(0,120)});
  }finally{clearTimeout(timeout)}
}