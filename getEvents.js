const mineflayer = require('mineflayer');
const nbt = require('prismarine-nbt');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const majors = ['Blockhead', 'Pizza', 'Beast', 'Robbery', 'Spire', 'Squads', 'Team Deathmatch', 'Raffle', 'Rage Pit'];
const OFFSET_CONSTANT = 59 * 1000; // sort of arbitrary, but works

/** @returns {Promise<{timestamp: number, event: string}[]>} */
const getEvents = () => new Promise(resolve => {
  let resolved = false;
  setTimeout(async () => {
    if(resolved) return;
    console.log('BOT FAILED? retrying in 30 seconds.');
    bot.quit();
    await new Promise(r => setTimeout(r, 30e3));
    resolve(getEvents());
  }, 60e3);
  const bot = mineflayer.createBot({
    host: 'mc.hypixel.net',
    username: process.env.EMAIL,
    password: process.env.PASSWORD,
    auth: 'microsoft',
  });

  let state = 'connecting';
  let toClear = [];
  
  bot.on('message', msg => {
    console.log('INGAME CHAT: "' + msg.toString() + '"');
  });

  bot.on('spawn', async () => {
    for(const [event, fn, onClear] of toClear) {
      bot.removeListener(event, fn);
      onClear();
    }
    toClear = [];
    switch(state){
      case 'connecting': {
        state = 'main lobby';
        const waiting = 5e3 + 5e3 * Math.random();
        console.log(`Waiting ${waiting / 1e3} seconds!`);
        await sleep(waiting);
        bot.chat('/play pit');
      }
      case 'main lobby': {
        let inPit = false;
        let cleared = false;
        const msgListener = jsonMsg => {
          const msg = jsonMsg.toString();
          if(msg.startsWith('PIT!')) {
            console.log('Entered pit!');
            inPit = true;
          }
        }
        setTimeout(() => {
          if(cleared) return;
          if(inPit) {
            console.log('Checking events!');
            bot.chat('/events');
            /** @type {mineflayer.BotEvents['windowOpen']} */
            const onWindowFn = window => {
              /** @type {import('prismarine-item').Item[]} */
              const items = window.containerItems();
              const lore = items.map(item => nbt.simplify(item.nbt).display.Lore).flat(1).map(s => JSON.parse(s).extra[0].extra.map(t => t.text).join(''));
              const processed = lore.map(s => s.match(/\+(\d\d)h(\d\d)m: (.*)$/))
                .filter(Boolean)
                .map(m => {
                  const now = Math.floor(Date.now() / 60e3) * 60e3; 
                  const offset = (parseInt(m[1]) * 60 + parseInt(m[2])) * 60e3;
                  const event = m[3];
                  return {
                    event,
                    timestamp: (Math.floor((now + offset) / 60000) * 60000) + OFFSET_CONSTANT,
                    type: majors.includes(event) ? 'major' : 'minor',
                  };
                });
              resolved = true;
              resolve(processed);
              bot.quit();
            };
            bot.on('windowOpen', onWindowFn);
            toClear.push(['windowOpen', onWindowFn, () => console.error('THIS SHOULD NEVER APPEAR')]);
          } else {
            bot.chat('/play pit');
          }
        }, 1e3 + 3e3 * Math.random());
        bot.on('message', msgListener);
        toClear.push(['message', msgListener, () => cleared = true]);
      }
    }
  });
});

module.exports = getEvents;
