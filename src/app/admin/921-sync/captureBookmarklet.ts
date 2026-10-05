const FALLBACK_921_ID = "6a63fc9b4b5736c5a8d6332b";
export const CAPTURE_921_VERSION = "2026-09-17.3";

/**
 * One-time bookmark setup: copy this string into a browser bookmark's URL.
 * Run it only while viewing Bentley's public 921 DineOnCampus menu.
 *
 * The helper deliberately avoids direct API calls. Instead it reads the menu
 * already rendered by DineOnCampus, opens each public nutrition dialog, records
 * the published values, and switches through Breakfast/Lunch/Dinner. No cookies,
 * storage values, credentials, or request headers are collected.
 */
const CAPTURE_921_SCRIPT = String.raw`(async()=>{
  try {
    const fallback=${JSON.stringify(FALLBACK_921_ID)};
    const captureVersion=${JSON.stringify(CAPTURE_921_VERSION)};
    const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const clean=value=>String(value??"").replace(/\s+/g," ").trim();
    const slug=value=>clean(value).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
    const dateMatch=location.pathname.match(/\/(\d{4}-\d{2}-\d{2})\//);
    const menuDate=dateMatch?dateMatch[1]:new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
    const activeLocation=document.querySelector('[data-location-id][aria-selected="true"]');
    const upstreamLocationId=activeLocation?.getAttribute("data-location-id")||fallback;

    const waitFor=async(fn,timeout=15000,interval=100)=>{
      const started=Date.now();
      while(Date.now()-started<timeout){
        const value=fn();
        if(value)return value;
        await sleep(interval);
      }
      throw new Error("Timed out waiting for DineOnCampus.");
    };

    const getPeriodName=()=>clean(document.querySelector('button[aria-controls="period-listbox"] span.text-xs')?.textContent);
    const getItemButtons=()=>[...document.querySelectorAll('#menu-content button[aria-label^="View nutritional information for "]')].filter(button=>{
      const label=button.getAttribute("aria-label")||"";
      return !/,\s*portion\s/i.test(label)&&!/,\s*[\d,.]+\s+calories$/i.test(label);
    });
    const menuSignature=()=>getItemButtons().map(button=>clean(button.textContent)).filter(Boolean).join("|");
    const itemCount=()=>getItemButtons().length;

    const menuMutationTracker=()=>{
      let changes=0;
      let lastChangedAt=0;
      const touchesMenu=record=>{
        const target=record.target;
        if(target instanceof Element&&(target.id==="menu-content"||target.closest?.("#menu-content")))return true;
        const nodes=[...record.addedNodes,...record.removedNodes];
        return nodes.some(node=>node instanceof Element&&(node.id==="menu-content"||node.matches?.("#menu-content")||node.querySelector?.("#menu-content")));
      };
      const observer=new MutationObserver(records=>{
        if(records.some(touchesMenu)){
          changes+=1;
          lastChangedAt=Date.now();
        }
      });
      observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true});
      return {
        get changes(){return changes;},
        get lastChangedAt(){return lastChangedAt;},
        stop(){observer.disconnect();},
      };
    };

    const stationFor=button=>{
      const wrapper=button.closest(".p-4");
      const toggle=wrapper?.querySelector('[aria-label^="Toggle "][aria-label$=" category"]');
      const label=toggle?.getAttribute("aria-label")||"";
      return clean(label.replace(/^Toggle /,"").replace(/ category$/, ""))||"921 Dining";
    };

    const basicsFor=button=>{
      const row=button.closest("tr");
      const cells=row?[...row.querySelectorAll(":scope > td")]:[];
      const name=clean(button.textContent);
      const labels=row?[...row.querySelectorAll("button[aria-label]")].map(node=>node.getAttribute("aria-label")||""):[];
      const portionLabel=labels.find(label=>label.includes(", portion "));
      const calorieLabel=labels.find(label=>/,\s*[\d,.]+\s+calories$/i.test(label));
      const portion=portionLabel?clean(portionLabel.split(", portion ").pop()):clean(cells[1]?.textContent);
      const calorieMatch=calorieLabel?.match(/,\s*([\d,.]+)\s+calories$/i);
      const calories=calorieMatch?Number(calorieMatch[1].replace(/,/g,"")):null;
      const dietary=row?[...row.querySelectorAll("img[alt]")].map(img=>clean(img.alt)).filter(Boolean):[];
      let description="";
      const descriptionNode=cells[0]?.querySelector(".mt-1.pl-2");
      if(descriptionNode)description=clean(descriptionNode.textContent);
      return {name,description,portion,calories:Number.isFinite(calories)?calories:null,dietary};
    };

    const parseNumber=value=>{
      const raw=clean(value).toLowerCase();
      if(!raw||raw.startsWith("-"))return null;
      if(raw.includes("less than 1"))return 0.5;
      const match=raw.match(/-?\d+(?:\.\d+)?/);
      return match?Number(match[0]):null;
    };

    const readNutrition=()=>{
      const modal=document.querySelector('div[role="dialog"][aria-modal="true"][aria-labelledby="nutrition-modal-title"]');
      if(!modal)return null;
      const title=clean(modal.querySelector("#nutrition-modal-title")?.textContent);
      const servingLine=[...modal.querySelectorAll("p")].map(node=>clean(node.textContent)).find(value=>/^Serving size:/i.test(value));
      const caloriesRow=[...modal.querySelectorAll("div")].find(node=>{
        const spans=node.querySelectorAll(":scope > span");
        return spans.length===2&&clean(spans[0].textContent)==="Calories";
      });
      let calories=null;
      if(caloriesRow){
        const spans=caloriesRow.querySelectorAll(":scope > span");
        calories=parseNumber(spans[1]?.textContent);
      }
      const nutrients={};
      [...modal.querySelectorAll(".flex.justify-between.py-1")].forEach(row=>{
        const spans=row.querySelectorAll(":scope > span");
        if(spans.length<2)return;
        const key=clean(spans[0].textContent);
        const raw=clean(spans[1].textContent);
        if(key)nutrients[key]={raw,value:parseNumber(raw)};
      });
      let ingredients="";
      [...modal.querySelectorAll("p")].forEach(node=>{
        const value=clean(node.textContent);
        if(/^Ingredients:/i.test(value))ingredients=value.replace(/^Ingredients:\s*/i,"");
      });
      return {title,servingSize:servingLine?servingLine.replace(/^Serving size:\s*/i,""):"",calories,nutrients,ingredients};
    };

    const closeNutrition=async()=>{
      const close=document.querySelector('button[aria-label="Close nutrition information modal"]');
      if(close)close.click();
      await waitFor(()=>!document.querySelector('div[role="dialog"][aria-modal="true"][aria-labelledby="nutrition-modal-title"]'),4000,50).catch(()=>{});
      await sleep(80);
    };

    const waitForStableMenu=async(periodName,{baselineSignature="",mustTransition=false,tracker=null}={})=>{
      const started=Date.now();
      let previous="";
      let stablePasses=0;
      let sawDifferentSignature=!mustTransition;
      while(Date.now()-started<30000){
        const active=getPeriodName().toLowerCase()===periodName.toLowerCase();
        const pathReady=location.pathname.toLowerCase().endsWith("/"+slug(periodName));
        const signature=menuSignature();
        const count=itemCount();
        if(signature&&signature!==baselineSignature)sawDifferentSignature=true;
        const sawMenuMutation=Boolean(tracker&&tracker.changes>0);
        const transitionReady=!mustTransition||sawDifferentSignature||sawMenuMutation;
        const mutationSettled=!tracker||tracker.lastChangedAt===0||Date.now()-tracker.lastChangedAt>=900;
        if(active&&pathReady&&count>0&&signature&&transitionReady&&mutationSettled){
          if(signature===previous)stablePasses+=1;
          else { previous=signature; stablePasses=1; }
          if(stablePasses>=6)return {signature,count};
        } else {
          stablePasses=0;
          previous="";
        }
        await sleep(300);
      }
      throw new Error(periodName+" never finished rendering a stable non-empty menu. Capture aborted; no incomplete file was created.");
    };

    const choosePeriod=async periodName=>{
      const alreadyActive=getPeriodName().toLowerCase()===periodName.toLowerCase()&&location.pathname.toLowerCase().endsWith("/"+slug(periodName));
      if(alreadyActive){
        return waitForStableMenu(periodName);
      }

      const baselineSignature=menuSignature();
      const tracker=menuMutationTracker();
      try {
        const trigger=document.querySelector('button[aria-controls="period-listbox"]');
        if(!trigger)throw new Error("Could not find the DineOnCampus Menu selector.");
        trigger.click();
        await waitFor(()=>{
          const list=document.querySelector("#period-listbox");
          return list&&list.offsetParent!==null?list:null;
        });
        const option=[...document.querySelectorAll("#period-listbox li[data-period-id]")].find(node=>clean(node.textContent).toLowerCase()===periodName.toLowerCase());
        if(!option)throw new Error("Could not find "+periodName+" in the DineOnCampus Menu selector.");
        option.click();
        await waitFor(()=>getPeriodName().toLowerCase()===periodName.toLowerCase(),10000,100);
        await waitFor(()=>location.pathname.toLowerCase().endsWith("/"+slug(periodName)),10000,100);
        return await waitForStableMenu(periodName,{baselineSignature,mustTransition:true,tracker});
      } finally {
        tracker.stop();
      }
    };

    const captureCurrentPeriod=async periodName=>{
      const buttons=getItemButtons();
      if(buttons.length===0)throw new Error(periodName+" contains zero rendered menu items. Capture stopped so Falcon Fuel cannot publish an incomplete day.");
      const categories=new Map();
      for(let index=0;index<buttons.length;index+=1){
        const button=buttons[index];
        if(!button.isConnected)throw new Error(periodName+" changed while it was being captured. Rerun the capture and leave the DineOnCampus tab untouched until it finishes.");
        const basic=basicsFor(button);
        const station=stationFor(button);
        let nutrition=null;
        try{
          button.scrollIntoView({block:"center"});
          button.click();
          await waitFor(()=>document.querySelector('div[role="dialog"][aria-modal="true"][aria-labelledby="nutrition-modal-title"]'),5000,50);
          nutrition=readNutrition();
        } finally {
          await closeNutrition();
        }
        if(!categories.has(station))categories.set(station,[]);
        categories.get(station).push({...basic,nutrition});
      }
      const result={name:periodName,categories:[...categories.entries()].map(([name,items])=>({name,items}))};
      const capturedCount=result.categories.reduce((sum,category)=>sum+category.items.length,0);
      if(capturedCount===0)throw new Error(periodName+" produced zero captured items. Capture aborted.");
      return result;
    };

    const available=[...document.querySelectorAll("#period-listbox li[data-period-id]")].map(node=>clean(node.textContent)).filter(Boolean);
    const periodsToCapture=["Breakfast","Lunch","Dinner"].filter(period=>available.some(value=>value.toLowerCase()===period.toLowerCase()));
    if(periodsToCapture.length===0){
      const current=getPeriodName();
      if(!current)throw new Error("Could not determine the current 921 meal period.");
      periodsToCapture.push(current);
    }

    if(!confirm("Falcon Fuel 921 capture "+captureVersion+" will capture "+periodsToCapture.join(", ")+". Leave this tab open and untouched until it finishes. Continue?"))return;

    const periods=[];
    const diagnostics=[];
    for(const periodName of periodsToCapture){
      const ready=await choosePeriod(periodName);
      const captured=await captureCurrentPeriod(periodName);
      periods.push(captured);
      diagnostics.push({name:periodName,readyItemCount:ready.count,capturedItemCount:captured.categories.reduce((sum,category)=>sum+category.items.length,0)});
    }

    const missing=periodsToCapture.filter(periodName=>{
      const period=periods.find(value=>value.name===periodName);
      return !period||period.categories.reduce((sum,category)=>sum+category.items.length,0)===0;
    });
    if(missing.length)throw new Error("Capture incomplete for: "+missing.join(", ")+". No file was created.");

    const capture={schemaVersion:1,captureVersion,source:"dineoncampus-browser-dom",outletKey:"921",outletName:"The 921",menuDate,capturedAt:new Date().toISOString(),pageUrl:location.href,upstreamLocationId,periods,diagnostics};
    const blob=new Blob([JSON.stringify(capture,null,2)],{type:"application/json"});
    const link=document.createElement("a");
    link.href=URL.createObjectURL(blob);
    link.download="falcon-fuel-921-"+menuDate+".json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(()=>URL.revokeObjectURL(link.href),1000);
    alert("Falcon Fuel capture "+captureVersion+" finished: "+diagnostics.map(row=>row.name+" "+row.capturedItemCount).join(" · ")+". Return to 921 Daily Sync to preview before publishing.");
  } catch(error) {
    console.error(error);
    alert("Falcon Fuel capture "+captureVersion+" stopped: "+(error instanceof Error?error.message:String(error)));
  }
})()`;

export const CAPTURE_921_BOOKMARKLET = `javascript:${CAPTURE_921_SCRIPT.replace(/\s+/g, " ").trim()}`;
