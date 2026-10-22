/* SIMULAB V6 chronological validation worker.
 * Uses identical engine code; progress reported without blocking mobile interface.
 */
"use strict";
importScripts("./v6-engine.js");
self.addEventListener("message",e=>{
 const msg=e.data||{},job=String(msg.job||"");
 if(msg.type!=="backtest"||!Array.isArray(msg.leagueMatches)||msg.leagueMatches.length>16000){
  self.postMessage({job,error:"Geçersiz geçmiş maç test talebi"});return;
 }
 try{
  const result=self.SIMULAB_ENGINE_V6.backtest({
   leagueMatches:msg.leagueMatches,allMatches:Array.isArray(msg.allMatches)?msg.allMatches.slice(0,16000):[],
   xgRows:Array.isArray(msg.xgRows)?msg.xgRows.slice(0,5000):[],
   maxGames:Math.max(20,Math.min(500,Number(msg.maxGames)||130)),
   onProgress:(done,total)=>self.postMessage({job,type:"progress",done,total})
  });
  self.postMessage({job,type:"result",result});
 }catch(error){self.postMessage({job,type:"error",error:String(error?.message||error).slice(0,200)})}
});