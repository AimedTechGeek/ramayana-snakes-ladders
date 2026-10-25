// SMOKE_SCRIPT step: start a game via Boot and Setup, play turns until a ladder or snake has happened or 40 rolls,
// then roll in fast mode until the game is over and the Win overlay is up.
export default async function playSomeTurns(page) {
  await page.mouse.click(640, 440); // Boot: Play
  await page.waitForFunction(
    () => window.__game?.scene.isActive('Setup') && window.__game.registry.get('setup'),
    null,
    {
      timeout: 10_000,
    },
  );
  await page.mouse.click(1108, 620); // Setup: Start
  await page.waitForFunction(() => window.__game?.registry.get('board-ready') === true, null, {
    timeout: 10_000,
  });
  const rolls = await page.evaluate(async () => {
    const board = window.__game.registry.get('board');
    const idle = () => new Promise((r) => setTimeout(r, 30));
    let count = 0;
    while (count < 40 && !board.snapshot().over) {
      while (board.isBusy) await idle();
      await board.requestRoll();
      count++;
      if (board.snapshot().players.some((p) => p.position > 30)) break;
    }
    return count;
  });
  if (rolls === 0) throw new Error('no rolls happened');

  // Keep playing in fast mode until the game is over (bots roll themselves), then wait for the Win overlay.
  await page.evaluate(async () => {
    const board = window.__game.registry.get('board');
    const idle = () => new Promise((r) => setTimeout(r, 30));
    board.fastMode = true;
    let count = 0;
    while (!board.snapshot().over && count < 400) {
      while (board.isBusy) await idle();
      await board.requestRoll();
      count++;
    }
  });
  await page.waitForFunction(() => window.__game?.registry.get('win'), null, { timeout: 60_000 });
}
