// SMOKE_SCRIPT step: start a 1 human + 1 bot game through window.__app, roll until a token passes square 30 or
// 40 rolls, then switch to Fast and roll until the game is over and the Win dialog is up.
export default async function playSomeTurns(page) {
  await page.evaluate(() =>
    window.__app.startGame({
      level: 'easy',
      playOn: false,
      players: [
        { hero: 'rama', controller: 'human', name: 'Rama' },
        { hero: 'hanuman', controller: 'bot', name: 'Hanuman' },
      ],
    }),
  );
  const rolls = await page.evaluate(async () => {
    const app = window.__app;
    const idle = () => new Promise((r) => setTimeout(r, 30));
    let count = 0;
    while (count < 40 && !app.state().game.over) {
      while (app.isBusy) await idle();
      await app.requestRoll();
      count++;
      if (app.state().game.players.some((p) => p.position > 30)) break;
    }
    return count;
  });
  if (rolls === 0) throw new Error('no rolls happened');

  await page.evaluate(async () => {
    const app = window.__app;
    const idle = () => new Promise((r) => setTimeout(r, 30));
    app.setFast(true);
    let count = 0;
    while (!app.state().game.over && count < 400) {
      while (app.isBusy) await idle();
      await app.requestRoll();
      count++;
    }
  });
  await page.waitForFunction(() => window.__app.state().winShown, null, { timeout: 60_000 });
}
