import chalk from "chalk";
import express from "express";
import http from "http";
import WebSocket, { WebSocketServer } from "ws";

const app = express();
const server = http.createServer(app);

// setup websocket server
const wss = new WebSocketServer({
  server,
});

function startCounter(ws: WebSocket, count: number) {
  return setInterval(() => {
    ws.send(`count ${count++}`);
  }, 2000);
}

// wss connection
wss.on("connection", (ws) => {
  console.log(chalk.green.bold("    Connection Connected"));

  ws.on("open", () => {
    console.log("Connection open event hitted! ");
  });

  let count = 0;

  // start timer
  let clearId = startCounter(ws, count);

  ws.on("message", (rawData, isBinary) => {
    // converting Binary data to utf-8 string
    const parsedData = JSON.parse(JSON.stringify(rawData));
    const data = Buffer.from(parsedData.data).toString();

    console.log("Incoming Data : ", data);

    if (data.trim() === "Stop") clearInterval(clearId);
    else if (data.trim() === "Start") clearId = startCounter(ws, count);
  });

  ws.on("close", () => {
    console.log(chalk.red.bold("    Connection Closed"));
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server is listening at http://localhost:${PORT}`);
});
