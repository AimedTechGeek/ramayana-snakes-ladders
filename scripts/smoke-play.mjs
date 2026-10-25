// SMOKE_SCRIPT step: start a game from Boot and play turns until a ladder or snake has happened or 40 rolls.
export default async function playSomeTurns(page) {
  await page.mouse.click(640, 440); // Boot: Play
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
}
