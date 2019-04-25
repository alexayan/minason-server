const ws = require("ws");
const EventEmitter = require("events");
const logger = require("./utils/logger");
const tools = require("./utils/tools");
const protocol = require("./protocol");
const _ = require("lodash");
const artTemplate = require("art-template");
const diffpatch = require("./utils/diffpatch");

class MinaClient extends EventEmitter {
  constructor(wss, minason) {
    super();
    this.minason = minason;
    this.initSocket(wss);
    this.initMinaContext();
  }

  log(msg, ...opt) {
    logger.info(`client ${this.id} ${msg}`, ...opt);
  }

  get id() {
    return this.wss ? this.wss.id : tools.uid();
  }

  get isAlive() {
    if (!this.wss) {
      return false;
    }
    if (
      this.wss.readyState === ws.CLOSED ||
      this.wss.readyState === ws.CLOSING
    ) {
      return false;
    }
    return this.wss.isAlive;
  }

  initSocket(wss) {
    wss.isAlive = true;
    wss.on("pong", () => {
      wss.isAlive = true;
    });
    wss.on("close", (code, reason) => {
      this.log(`closed, code: ${code}, reason: ${reason}`);
      wss.isAlive = false;
      this.destory();
    });
    wss.on("error", err => {
      logger.error(err.message, err.stack);
    });
    wss.on("message", data => {
      this.log(`receive message: ${data}`);
      data = JSON.parse(data);
      switch (data.type) {
        case protocol.REMOTE_ERROR_RESULT:
        case protocol.REMOTE_SUCCESS_RESULT:
          this.emit(data.id, data);
          break;
        case protocol.REMOTE_CALL:
          this.local(data);
          break;
        case protocol.REFRESH:
          this.refresh(true);
          break;
        default:
          break;
      }
    });
    this.wss = wss;
  }

  send(data) {
    if (!this.isAlive) {
      return;
    }
    if (_.isObject(data)) {
      data = JSON.stringify(data);
    } else {
      data = String(data);
    }
    return this.wss.send(data);
  }

  async local(data) {
    try {
      const method = _.get(data, "data.method", "");
      this.log(`id: ${data.id}, call local method: ${method}`);
      if (!method || !this.minason.methods[method]) {
        return this.send({
          id: data.id,
          type: protocol.REMOTE_ERROR_RESULT,
          data: `method ${method} not found`
        });
      }
      const resp = await this.minason.methods[method].apply(
        this,
        _.get(data, "data.args", [])
      );
      return this.send({
        id: data.id,
        type: protocol.REMOTE_SUCCESS_RESULT,
        data: resp
      });
    } catch (e) {
      return this.send({
        id: data.id,
        type: protocol.REMOTE_ERROR_RESULT,
        data: e.message
      });
    }
  }

  remote(method) {
    return async (...args) => {
      return new Promise((resolve, reject) => {
        const callProtocol = {
          id: tools.uid(),
          type: protocol.REMOTE_CALL,
          data: {
            method,
            args
          }
        };
        this.once(callProtocol.id, resp => {
          if (resp.type === protocol.REMOTE_SUCCESS_RESULT) {
            resolve(resp.data);
          } else {
            reject(new Error(resp.data));
          }
        });
        this.send(callProtocol);
      });
    };
  }

  initMinaContext() {
    this._changedKeys = [];
    this.data = new Proxy(
      {},
      {
        set: (obj, prop, value) => {
          const oldValue = Reflect.get(obj, prop);
          if (!_.isEqual(oldValue, value)) {
            this._changedKeys.push(prop);
          }
          return Reflect.set(obj, prop, value);
        }
      }
    );
    this.session = {};
    this.storage = {};
    this.wx = new Proxy(
      {},
      {
        get: (obj, prop) => {
          const value = Reflect.get(obj, prop);
          if (value) {
            return value;
          }
          return this.remote(prop);
        }
      }
    );
    if (this.minason.config.template) {
      this.template = this.minason.config.template;
    }
    if (!_.isEmpty(this.minason.config.data)) {
      _.assign(this.data, this.minason.config.data);
    }
  }

  get template() {
    return this._template;
  }

  set template(value) {
    this._template = value;
    this._tempateChanged = true;
    this._compiledTemplate = artTemplate.compile(value, {
      escape: false
    });
  }

  get global() {
    return this.minason.global;
  }

  generateView(force) {
    let newTemplate = "";
    if (this.minason.config.generateView) {
      newTemplate = this.minason.config.generateView.call(
        this,
        _.clone(this.data),
        this.template
      );
    } else {
      newTemplate = this._compiledTemplate(this.data);
    }
    const oldTemplate = this._oldTemplate;
    const oldTemplateId = this._oldTemplateId;
    const newTemplateId = tools.uid();
    this._oldTemplate = newTemplate;
    this._oldTemplateId = newTemplateId;
    if (force || !oldTemplate || !oldTemplateId) {
      return {
        type: "full",
        content: newTemplate,
        id: newTemplateId
      };
    }
    try {
      const patches = diffpatch.patch_make(oldTemplate, newTemplate);
      return {
        type: "patch",
        patches,
        oid: oldTemplateId,
        nid: newTemplateId
      };
    } catch (e) {
      console.error(e);
      return {
        type: "full",
        content: newTemplate,
        id: newTemplateId
      };
    }
  }

  refresh(force) {
    const datas = _.pick(this.data, this._changedKeys);
    const refreshData = {};
    if (!_.isEmpty(datas)) {
      refreshData.datas = datas;
      this._changedKeys = [];
    }
    if (this._tempateChanged) {
      refreshData.template = this.template;
      this._tempateChanged = false;
    }
    if (_.isEmpty(refreshData) && !force) {
      return;
    }
    this.send({
      type: protocol.REFRESH,
      id: tools.uid(),
      data: this.generateView(force)
    });
  }

  destory() {
    this.removeAllListeners();
    this.minason.removeClient(this);
    if (this.wss) {
      if (this.wss.readyState === ws.OPEN) {
        this.wss.destory();
      }
    }
    this.session = null;
    this.storage = null;
    this.wss = null;
    this.minason = null;
  }
}

module.exports = MinaClient;
