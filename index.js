const dotenv = require('dotenv');
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

dotenv.config();

const getEvents = require('./getEvents');

const app = express();

app.use(cors());

/** @type {{timestamp: number, event: string, type: 'minor' | 'major'}[]} */
let events = [];

const addEvents = async () => {
  if(process.env.ENV === 'DEV'){
    // just used for testing so the bot doesnt have to logon excessively
    events = Array.from({length: 40}, (_, i) => {
      return {
        event: `event ${i}`,
        timestamp: Date.now() + i * 60e3,
        type: Math.random() < 1 / 8 ? 'major' : 'minor',
      }
    });
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
    // 2-4 hours
    await new Promise(r => setTimeout(r, (2 + Math.random() * 2) * 60 * 60 * 1e3))
  }
})();

/** @type {(key: string) => boolean} */
const isPossible = key => {
  if(key.length !== 36) return false; // 32 hex + 4 dashes
  for(let i = 0; i < 36; i++){
    if(i === 14) { // Ensure version 4 uuid
      if(key.charAt(i) !== '4') return false; 
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
    if(!isPossible(key)) return;

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
      await new Promise(r => setTimeout(r, 86400e3));
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

app.use('/1major3minor', async (req, res) => {
  // remove expired events
  while(events.length && events[0].timestamp < Date.now()) events.shift();

  const major = events.find(e => e.type === 'major') || { event: 'None', timestamp: 0, type: 'major' };

  const minors = events.filter(e => e.type === 'minor').slice(0, 3);
  while (minors.length < 3) {
    minors.push({ event: "None", timestamp: 0, type: 'minor' });
  }

  res.send({ major, minors });
});

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

app.listen(5002, () => console.log('API running on port 5002'));
