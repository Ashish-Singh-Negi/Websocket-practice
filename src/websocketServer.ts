import chalk from "chalk";
import type { IncomingMessage, Server } from "http";
import { parse as parseUrl } from "url";
import ws, { WebSocket, WebSocketServer } from "ws";

const connectedClients: Map<string, WebSocket> = new Map();

export function startWebsocketServer(server: Server) {
  const wss = new WebSocketServer({ server });

  // wss connection
  wss.on("connection", (ws: WebSocket, req) => {
    console.log(chalk.green.bold("Connection Connected"));

    // verify token
    const token = extractToken(req);
    const tokenData = authenticateUser(token!);
    if (!tokenData) {
      ws.close(4001, "Unauthenticated user");
      return;
    }

    // set new userId with corresponding ws to track connected client/users
    connectedClients.set(`${tokenData.userId}`, ws);

    // listen message
    ws.on("message", async (rawData) => {
      const data = parseRawData(rawData);
      console.log(new Date(), " ", data);

      const splitedData = data.split("-");

      // send message to specific user id
      if (data.startsWith("SEND-TO") && connectedClients.has(splitedData[2]!)) {
        const client = connectedClients.get(splitedData[2]!);

        if (client?.readyState === client?.OPEN) {
          client?.send(`${splitedData[3]}`);
        }
      }
    });

    ws.on("close", () => {
      console.log(chalk.red.bold("Connection Closed"));
    });
  });
}

function parseRawData(rawData: ws.RawData) {
  const parsedData = JSON.parse(JSON.stringify(rawData));
  const data = Buffer.from(parsedData.data).toString();

  return data;
}

function authenticateUser(token: string) {
  try {
    const decodedToken = Buffer.from(token, "base64").toString();
    const tokenData = JSON.parse(decodedToken);

    if (!tokenData.userId) {
      throw new Error("Invalid token structure");
    }

    return tokenData;
  } catch (error) {
    console.error("Authentication error:", error);
    return null;
  }
}

function extractToken(req: IncomingMessage) {
  const url = parseUrl(req.url!, true);
  const token = url.query.token;

  return token as string;
}

// function startCounter(ws: WebSocket, count: number) {
//   return setInterval(() => {
//     ws.send(`count ${count++}`);
//   }, 2000);
// }
