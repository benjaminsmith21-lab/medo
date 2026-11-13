# Medo

**I did it myself.** Morning and afternoon routines kids run on their own: talking quest board, weather and what to wear, leave-time clock, rewards, trophy case and photo proof.

Free, single-file web app. Open https://benjaminsmith21-lab.github.io/medo/ on a tablet or phone and install it to the home screen. Everything is saved on the device.

## Making changes

The whole app is `index.html` (plus `sw.js` for offline use). After any change:

1. Bump `BOARD_VERSION` near the top of the script. Running boards use it to notice an update.
2. Run the tests: `npm install` once, then `npm test`. They load the board in a fake tablet (jsdom) and check the main flows: ticking quests and stars, the grown-ups keypad, rewards and money jars, trophies, proof, birthdays, countdown wording, trips and holiday mode, away weather, holidays by country, first-run setup, feedback and usage stats.
3. Push to `main`. GitHub Pages publishes it, and boards refresh themselves within about 10–20 minutes.

Add a test in `test/board.test.js` for anything new that a family would notice if it broke.
