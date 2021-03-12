const dotenv = require('dotenv');
const express = require('express');

dotenv.config();

const getEvents = require('./getEvents');

const app = express();

/** @type {{timestamp: number, event: string}[]} */
let events = [];

const addEvents = async () => {
  const newEvents = await getEvents();
  const last = events[events.length - 1];
  const toAdd = newEvents.filter(e => e.timestamp > last.timestamp);
  events.push(toAdd);
};

// load events when process starts up
(async()=>{
  events = await getEvents();
})();

// every 6-10 hours reload events
setInterval(() => {
  addEvents();
}, (6 + Math.random() * 4) * 60 * 60 * 1e3);

app.use('/', (req, res) => {
  res.send(events);
});

app.listen(5002, () => console.log('API running on port 5000'));
