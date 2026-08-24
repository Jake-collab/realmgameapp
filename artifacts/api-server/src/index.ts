import app from "./app";
import { logger } from "./lib/logger";
import { validateModerationConfiguration } from "./lib/moderation";
import { readServerEnvironment } from "./lib/config";

const environment = readServerEnvironment();

validateModerationConfiguration();

app.listen(environment.PORT, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

    logger.info({ port: environment.PORT, environment: environment.NODE_ENV }, "Server listening");
});
