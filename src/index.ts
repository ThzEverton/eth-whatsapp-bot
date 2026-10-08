import "dotenv/config";
import { loadEnv } from "./config/env.js";
import { ConfigStore } from "./config/settings.js";
import { GameManager } from "./games/game-manager.js";
import { Connection } from "./bot/connection.js";
import { logger } from "./utils/logger.js";
import { Panel } from "./bot/panel.js";
process.umask(0o077);
async function main() {
  const env = loadEnv();
  const config = new ConfigStore(env.groups, env.configFile);
  await config.load();
  let connection: Connection;
  const manager = new GameManager(
    config,
    (...args) => connection.send(...args),
    (e) => logger.error({ err: e }, "Falha de envio/jogo"),
  );
  connection = new Connection(env.authDir, env.owner, manager);
  const panel = new Panel(manager, connection.send, {
    disconnect: () => connection.disconnectAccount(),
    connect: () => connection.connectAccount(),
  });
  connection.panel = panel;
  await panel.start();
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(signal, () => {
      connection.stop();
      panel.stop();
      process.exitCode = 0;
    });
  await connection.connect();
}
main().catch((e) => {
  logger.fatal({ err: e }, "Não foi possível iniciar");
  process.exitCode = 1;
});
