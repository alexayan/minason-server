const { createLogger, format, transports } = require("winston");
const { combine, timestamp, label, printf } = format;

const myFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${label}] ${level}: ${message}`;
});

const logger = createLogger({
  transports: [new transports.Console()],
  format: combine(label({ label: "minasan" }), timestamp(), myFormat)
});

module.exports = logger;
