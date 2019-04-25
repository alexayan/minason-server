"use strict";
const _ = require("lodash");
const WebSocket = require("ws");
const mdns = require("mdns");
const EventEmitter = require("events");
const superstruct = require("superstruct");
const logger = require("./utils/logger");
const MinaClient = require("./client");
const tools = require("./utils/tools");
const protocol = require("./protocol");

const defaultConfig = {
  ping: 10 * 1000,
  socket: {
    port: 8080,
    verifyClient: (info, cb) => {
      cb(true);
    }
  },
  template: "",
  global: {},
  methods: {}
};

const defaultConfigStruct = superstruct.struct({
  name: "string",
  desc: "string?",
  ping: "number",
  methods: "object",
  global: "object?",
  template: "string?",
  generateView: "function?",
  socket: {
    host: "string?",
    port: "number?",
    backlog: "number?",
    server: "any?",
    verifyClient: "function?",
    handleProtocols: "function?",
    path: "string?",
    noServer: "boolean?",
    clientTracking: "boolean?",
    perMessageDeflate: "any?",
    maxPayload: "number?"
  }
});

function noop() {}

class Minason extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = _.merge({}, defaultConfig, config);
    this.clients = [];
    defaultConfigStruct(this.config);
    this.global = this.config.global || {};
    this.methods = this.config.methods;
    this.initMdns();
  }

  handleMdnsError(error) {
    console.warn(error);
    setTimeout(this.initMdns, 5000);
  }

  initMdns() {
    try {
      const ad = mdns.createAdvertisement(
        mdns.tcp("http"),
        this.config.socket.port,
        {
          txtRecord: {
            name: this.config.name,
            desc: this.config.desc,
            minason: 1
          }
        }
      );
      ad.on("error", this.handleMdnsError.bind(this));
      this.ad = ad;
    } catch (e) {
      this.handleMdnsError(e);
    }
  }

  start() {
    const server = new WebSocket.Server(this.config.socket, () => {
      const address = server.address();
      logger.info(`server start at ${address.address} ${address.port}`);
      try {
        this.ad.start();
        logger.info(`mdns start`);
      } catch (e) {
        this.handleMdnsError(e);
      }
    });
    server.on("connection", (wss, req) => {
      wss.id = tools.uid();
      wss.ip = req.connection.remoteAddress;
      logger.info(
        `new connection ${wss.id} from ${req.connection.remoteAddress}`
      );
      this.addClient(new MinaClient(wss, this));
    });
    server.on("error", err => {
      logger.error(err.message, err.stack);
    });
    server.on("close", err => {
      logger.error(err.message, err.stack);
      this.ad.stop();
    });
    this.interval = setInterval(() => {
      server.clients.forEach(ws => {
        try {
          if (ws.isAlive === false) return ws.terminate();
          ws.isAlive = false;
          ws.ping(noop);
          ws.send(
            JSON.stringify({
              type: protocol.PING
            })
          );
        } catch (e) {}
      });
    }, this.config.ping);
  }

  addClient(client) {
    this.clients.push(client);
    this.emit("client-add", client);
  }

  removeClient(client) {
    const index = _.findIndex(this.clients, c => {
      return c.id === client.id;
    });
    if (index > -1) {
      this.emit("client-remove", this.clients.splice(index, 1)[0]);
    }
  }

  register(method, func) {
    this.methods[method] = func;
  }
}

Minason.logger = logger;

module.exports = Minason;
