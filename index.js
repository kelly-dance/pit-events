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
    const last = events[events.length - 1];
    const toAdd = newEvents.filter(e => e.timestamp > last.timestamp);
    events.push(...toAdd);
  }
};

// load events when process starts up
addEvents();

// every 4-8 hours reload events
setInterval(() => {
  addEvents();
}, (4 + Math.random() * 4) * 60 * 60 * 1e3);

const validateKey = (() => {
  const store = {};

  const checkKey = async key => {
    try{
      const keyRequest = await fetch(`https://api.hypixel.net/key?key=${key}`);
      if(!keyRequest.ok) return false;
      const keyData = await keyRequest.json();
      if(!keyData.success) return false;
      const playerRequest = await fetch(`https://api.hypixel.net/player?key=${key}&uuid=${keyData.record.owner}`);
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
    if(key in store) return store[key];
    const isValid = await checkKey(key);
    store[key] = isValid;
    // expire after 1 day
    setTimeout(() => store[key] = undefined, 86400e3);
    return isValid;
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
