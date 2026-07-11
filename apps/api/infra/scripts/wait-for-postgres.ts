import { exec } from "node:child_process";
import env from "infra/env";

const NODE_ENV = env.NODE_ENV.toLowerCase(); // development, test, production, staging

function checkPostgres() {
  exec(
    `docker exec postgres-${NODE_ENV === "development" ? "dev" : NODE_ENV} pg_isready --host localhost`,
    handleReturn,
  );

  function handleReturn(_error: Error | null, stdout: string) {
    if (stdout.search("accepting connections") === -1) {
      process.stdout.write(".");
      checkPostgres();
      return;
    }

    console.log("\n🟢 Postgres is ready and accepting connections!\n");
  }
}

process.stdout.write("\n\n🔴 Waiting for Postgres to accept connections");
checkPostgres();
