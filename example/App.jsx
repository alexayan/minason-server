const React = require("react");
const radium = require("radium");

const styles = {
  bg: {
    position: "fixed",
    width: "100%",
    height: "100%",
    top: "0px",
    left: "0px",
    background: "#f1f1f1",
    zIndex: "-1"
  },

  messages: {
    color: "#fff",
    background: "#f1f1f1",
    height: "100%",
    paddingBottom: "90px",
    boxSizing: "border-box"
  },

  message: {
    display: "flex",
    margin: "20px 15px",
    boxSizing: "border-box",
    owner: {
      justifyContent: "flex-end"
    },
    default: {
      justifyContent: "flex-start"
    }
  },

  messageContent: {
    flex: "0 0 auto",
    maxWidth: "65%",
    borderRadius: "12px",
    padding: "18px",
    fontSize: "16px",
    color: "#000",
    owner: {
      background: "rgb(255, 228, 200)"
    },
    default: {
      background: "#fff"
    }
  },

  sendMessageBtn: {
    position: "fixed",
    bottom: "0px",
    left: "0px",
    width: "100%",
    padding: "15px",
    boxSizing: "border-box",
    background: "#f7f7f7",
    borderTop: "1rpx solid rgba(0, 0, 0, 0.1)",
    marginBottom: "env(safe-area-inset-bottom)",
    input: {
      background: "#fff",
      padding: "10px",
      borderRadius: "4px"
    }
  }
};

module.exports = radium(props => {
  const { messages, uid } = props;
  return (
    <>
      <div className="bg" style={[styles.bg]} />
      <div className="messages" style={[styles.messages]}>
        {messages.map((item, index) => {
          let type = "owner";
          if (uid !== item.uid) {
            type = "default";
          }
          const args = encodeURI(JSON.stringify([item.content]));
          return (
            <div
              className="message"
              style={[styles.message, styles.message[type]]}
              key={index}
            >
              <div
                className="content"
                style={[styles.messageContent, styles.messageContent[type]]}
                data-tap="copyMessage"
                data-args={args}
              >
                {item.content}
              </div>
            </div>
          );
        })}
      </div>
      <div style={[styles.sendMessageBtn]} className="sent-btn">
        <input
          style={[styles.sendMessageBtn.input]}
          data-confirm="newMessage"
          data-confirmtype="send"
        />
      </div>
    </>
  );
});
