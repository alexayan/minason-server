require("@babel/register")({
  presets: ["@babel/preset-react"]
});

const _ = require("lodash");
const Minason = require("../lib/index");
const App = require("./App.jsx");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const uuidv4 = require("uuid/v4");

const minason = new Minason({
  name: "匿名聊天室",
  desc: "have fun :)",
  socket: {
    port: 9000
  },
  global: {},
  generateView(data) {
    return ReactDOMServer.renderToString(React.createElement(App, data));
  }
});

minason.on("client-add", () => {
  minason.clients.forEach(client => {
    if (!client.isAlive) {
      return;
    }
    client.wx.setNavigationBarTitle({
      title: minason.config.name + `(${minason.clients.length})`
    });
  });
});

minason.on("client-remove", () => {
  minason.clients.forEach(client => {
    if (!client.isAlive) {
      return;
    }
    client.wx.setNavigationBarTitle({
      title: minason.config.name + `(${minason.clients.length})`
    });
  });
});

minason.register("init", async function(state = {}) {
  _.assign(this.data, state, {
    messages: [],
    uid: uuidv4()
  });
  this.refresh();
  await new Promise(resolve => {
    setTimeout(resolve, 200);
  });
  this.wx.setNavigationBarTitle({
    title: this.minason.config.name + `(${minason.clients.length})`
  });
  this.wx.pageScrollTo({ scrollTop: 10000 });
});

minason.register("newMessage", async function(value) {
  if (!value) {
    return;
  }
  const message = {
    content: value,
    uid: this.data.uid
  };
  minason.clients.forEach(async client => {
    if (client.id === this.id) {
      return;
    }
    const messages = _.clone(client.data.messages);
    messages.push(message);
    client.data.messages = messages;
    client.refresh();
    await new Promise(resolve => {
      setTimeout(resolve, 200);
    });
    client.wx.pageScrollTo({ scrollTop: 10000 });
  });
  const messages = _.clone(this.data.messages);
  messages.push(message);
  this.data.messages = messages;
  this.refresh();
  await new Promise(resolve => {
    setTimeout(resolve, 200);
  });
  this.wx.pageScrollTo({ scrollTop: 10000 });
});

minason.register("copyMessage", async function(value) {
  await this.wx.setClipboardData({
    data: value
  });
});

minason.start();
