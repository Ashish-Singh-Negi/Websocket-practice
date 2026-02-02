import chalk from "chalk";
import type { IncomingMessage, Server } from "http";
import { parse as parseUrl } from "url";
import ws, { WebSocket, WebSocketServer } from "ws";

const connectedClients: Map<string, Set<WebSocket>> = new Map();

export function startWebsocketServer(server: Server) {
  const wss = new WebSocketServer({ server });

  // wss connection
  wss.on("connection", (ws: WebSocket, req) => {
    console.log(chalk.green.bold("Connection Connected"));

    const token = extractToken(req);
    const tokenData = authenticateUser(token!);
    if (!tokenData) {
      ws.close(4001, "Unauthenticated user");
      return;
    }

    // create a fake/dummy user
    connectedClients.set(`${tokenData.userId}`, new Set());
    connectedClients.get(`${tokenData.userId}`)?.add(ws);

    console.log(chalk.bgCyan.bold("User  ", JSON.stringify(tokenData)));

    // listen message
    ws.on("message", async (rawData) => {
      const data = parseRawData(rawData);

      console.log(new Date(), " ", data);

      // broadcast incoming message to all OPEN ws clinets
      wss.clients.forEach((client) => {
        // check client ws connection OPEN
        if (client.readyState === WebSocket.OPEN) {
          client.send(data);
        }
      });
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
