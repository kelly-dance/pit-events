const dotenv = require('dotenv');
const express = require('express');
const fetch = require('node-fetch');

dotenv.config();

const getEvents = require('./getEvents');

const app = express();

/** @type {{timestamp: number, event: string}[]} */
let events = [];

const addEvents = async () => {
  if(process.env.ENV === 'DEV'){
    // just used for testing so the bot doesnt have to logon excessively
    events = Array.from({length: 40}, (_, i) => ({event: `event ${i}`, timestamp: Date.now() + i * 60e3}));
  } else {
    const newEvents = await getEvents();
    const last = events[events.length - 1]?.timestamp || 0;
    const toAdd = newEvents.filter(e => e.timestamp > last);
    events.push(...toAdd);
  }
};

// Update events
(async()=>{
  while(true){
    await addEvents();
    // 4-8 hours
    await new Promise(r => setTimeout(r, (4 + Math.random() * 4) * 60 * 60 * 1e3))
  }
})();

/** @type {(key: string) => boolean} */
const isPossible = key => {
  if(key.length !== 36) return false; // 32 hex + 4 dashes
  for(let i = 0; i < 36; i++){
    if(i === 14) { // Ensure version 6 uuid
      if(key.charAt(i) !== '6') return false; 
    }
    else if([8, 13, 18, 23].includes(i)){ // ensure dashes are at correct place
      if(key.charAt(i) !== '-') return false;
    }
    else if(!'0123456789abcdef'.split('').includes(key.charAt(i))) return false; // ensure only hex characters
  }
  return true;
}

/** @typedef {{uuid: string, supporter: boolean, checked: number}} Entry */

const validateKey = (() => {
  /** @type {Record<string, Entry | false>} */
  const store = {};

  /** @type {(key: string) => Promise<undefined | string>} */
  const checkKey = async key => {
    if(!isPossible(key)) return false;

    try{
      const keyRequest = await fetch(`https://pitpanda.rocks/api/keyinfo?key=${process.env.APIKEY}&checkkey=${key}`);
      if(!keyRequest.ok) return;
      const keyData = await keyRequest.json();
      if(!keyData.success) return;
      return keyData.owner;
    }catch(e){
      return;
    }
  }

  /** @type {(uuid: string) => Promise<boolean>} */
  const checkUUID = async uuid => {
    try{
      const playerRequest = await fetch(`https://pitpanda.rocks/api/playerdoc/${uuid}?key=${process.env.APIKEY}`);
      if(!playerRequest.ok) return false;
      const playerDoc = await playerRequest.json();
      if(!playerDoc.success) return false;
      const isSupporter = !!playerDoc.Doc.pitSupporter;
      return isSupporter;
    }catch(e){
      console.log(e)
      return false;
    }
  }

  // Remove keys from cache
  (async()=>{
    while(true){
      await new Promise(r => setTimeout(r, 86400e3))
      for(const key of store){
        if(!store[key]) continue;
        if(store[key].checked + (30 * 86400e3) < Date.now()) delete store[key];
      }
    }
  })();

  return /** @type {(key: string) => Promise<Boolean>} */ async key => {
    if(key in store) {
      if(!store[key]) return false;
      if(store[key].supporter) return true;
      const supporter = await checkUUID(store[key].uuid);
      store[key].supporter = supporter;
      return supporter;
    }else{
      const uuid = await checkKey(key);
      if(!uuid) {
        store[key] = false;
        return false;
      }
      const supporter = await checkUUID(uuid);
      store[key] = { uuid, supporter, checked: Date.now() };
      return supporter;
    }
  }
})();
let majors = ["tdm", "teamdeathmatch", "ragepit", "raffle", "beast", "squads", "blockhead", "robbery", "spire", "pizza", "delivery"]
app.use('/', async (req, res) => {
  // remove expired events
  while(events.length && events[0].timestamp < Date.now()) events.shift();

  let key = req.get('X-API-Key') || req.query.key;

  if(key){
    const isValid = await validateKey(key);
    if(isValid) return res.send(events);
  }
  
  // without a key limit to only the next 5 events
  res.send(events.slice(0, 5));
});
app.use('/1major3minor', async (req, res) => { // UNTESTED
  // remove expired events
  while(events.length && events[0].timestamp < Date.now()) events.shift();
  let minor = events.filter(x=>!majors.includes(x.event.replace(/ +/g, "").toLowerCase())).slice(0, 3)
  while (minors.length < 3) {minors.push({event: "None", timestamp: 0})}
  let major = events.find(x=>majors.includes(x.event.replace(/ +/g, "").toLowerCase())) || {event: "None", timestamp: 0}
  res.send({major, minor})
});
app.listen(5002, () => console.log('API running on port 5002'));
