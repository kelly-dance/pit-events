const dotenv = require('dotenv');
const express = require('express');
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

const clearExpired = () => {
  while(events.length && events[0].timestamp < Date.now()) {
    events.shift();
  }
}

app.use('/1major3minor', async (req, res) => {
  clearExpired();

  const major = events.find(e => e.type === 'major') || { event: 'None', timestamp: 0, type: 'major' };

  const minors = events.filter(e => e.type === 'minor').slice(0, 3);
  while (minors.length < 3) {
    minors.push({ event: "None", timestamp: 0, type: 'minor' });
  }

  res.send({ major, minors });
});

app.use('/', async (req, res) => {
  clearExpired();

  return res.send(events);
});

app.listen(5002, () => console.log('API running on port 5002'));
