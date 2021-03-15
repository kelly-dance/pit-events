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

(async()=>{
  while(true){
    await addEvents();
    // 4-8 hours
    await new Promise(r => setTimeout(r, (4 + Math.random() * 4) * 60 * 60 * 1e3))
  }
})();

/** @typedef {{uuid: string, supporter: boolean}} Entry */

const validateKey = (() => {
  /** @type {Record<string, Entry>} */
  const store = {};

  /** @type {(key: string) => Promise<undefined | string>} */
  const checkKey = async key => {
    try{
      const keyRequest = await fetch(`https://api.hypixel.net/key?key=${key}`);
      if(!keyRequest.ok) return;
      const keyData = await keyRequest.json();
      if(!keyData.success) return;
      return keyData.record.owner;
    }catch(e){
      return;
    }
  }

  /** @type {(uuid: string) => Promise<boolean>} */
  const checkUUID = async uuid => {
    try{
      const playerRequest = await fetch(`https://api.hypixel.net/player?key=${process.env.APIKEY}&uuid=${uuid}`);
      if(!playerRequest.ok) return false;
      const playerData = await playerRequest.json();
      if(!playerData.success) return false;
      const isSupporter = !!(playerData.player?.stats?.Pit?.packages?.includes('supporter'));
      return isSupporter;
    }catch(e){
      return false;
    }
  }

  return /** @type {(key: string) => Promise<Boolean>} */ async key => {
    if(key in store) {
      if(store[key].supporter) return true;
      const supporter = await checkUUID(store[key].uuid);
      store[key].supporter = supporter;
      return supporter;
    }
    const uuid = await checkKey(key);
    if(!uuid) return false;
    const supporter = await checkUUID(uuid);
    store[key] = { uuid, supporter };
    // expire after 7 days
    setTimeout(() => store[key] = undefined, 7 * 24 * 60 * 60 * 1e3);
    return supporter;
  }
})();

app.use('/', async (req, res) => {
  // remove expired events
  while(events.length && events[0].timestamp < Date.now()) events.shift();

  let key = req.query.key;

  if(key && key.length === 36){
    const isValid = await validateKey(key);
    if(isValid) return res.send(events);
  }
  
  // without a key limit to only the next 5 events
  res.send(events.slice(0, 5));
});

app.listen(5002, () => console.log('API running on port 5002'));
