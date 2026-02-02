import chalk from "chalk";
import type { Server } from "http";
import ws, { WebSocket, WebSocketServer } from "ws";

export function startWebsocketServer(server: Server) {
  const wss = new WebSocketServer({ server });

  // wss connection
  wss.on("connection", (ws: WebSocket) => {
    let count = 0;
    console.log(chalk.green.bold("    Connection Connected"));

    ws.on("open", () => {
      console.log("Connection open event hitted! ");
    });

    // start timer
    let clearId = startCounter(ws, count);

    ws.on("message", (rawData, isBinary) => {
      // converting Binary data to utf-8 string
      const data = parseRawData(rawData);

      if (data.trim() === "Stop") clearInterval(clearId);
      else if (data.trim() === "Start") clearId = startCounter(ws, count);

      console.log("Incoming Data : ", data);
    });

    ws.on("close", () => {
      console.log(chalk.red.bold("    Connection Closed"));
    });
  });
}

function parseRawData(rawData: ws.RawData) {
  const parsedData = JSON.parse(JSON.stringify(rawData));
  const data = Buffer.from(parsedData.data).toString();

  return data;
}

function startCounter(ws: WebSocket, count: number) {
  return setInterval(() => {
    ws.send(`count ${count++}`);
  }, 2000);
}
