import chalk from "chalk";
import { randomUUID } from "crypto";
import type { IncomingMessage, Server } from "http";
import { parse as parseUrl } from "url";
import ws, { WebSocket, WebSocketServer } from "ws";

const connectedClients: Map<string, WebSocket> = new Map();
const chatRooms: Map<string, Set<WebSocket>> = new Map();

type MessageType = "CREATE" | "JOIN" | "LEAVE" | "MESSAGE" | "TYPING";
interface Message {
  type: MessageType;
  payload: any;
  timestamp: Date;
}

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

    // send tokenData back to user
    sendMessage(ws, `${tokenData.user}`);

    // set new userId with corresponding ws to track connected client/users
    if (!connectedClients.has(tokenData.user)) {
      connectedClients.set(`${tokenData.user}`, ws);
    }

    // listen message
    ws.on("message", async (rawData) => {
      const data = parseRawData(rawData);

      handleIncomingMessage(ws, data, tokenData);
    });

    ws.on("close", () => {
      console.log(chalk.red.bold("Connection Closed"));
      console.log("user id : ", tokenData.userId);
      connectedClients.delete(tokenData.user);
    });
  });
}

function handleIncomingMessage(
  ws: WebSocket,
  data: string,
  tokenData: { user: string },
) {
  const message: Message = JSON.parse(data);
  switch (message.type as MessageType) {
    case "CREATE":
      createChatRoom(ws, tokenData.user);
      break;

    case "JOIN":
      joinChatRoom(ws, message);
      break;

    case "MESSAGE":
      broadcastMessageInChatRoom(ws, message, tokenData);
      break;

    case "LEAVE":
      leaveChatRoom(ws, message, tokenData);
      break;

    default:
      console.log("Invalid Message type ", message.type);
      break;
  }
}

function createChatRoom(ws: WebSocket, user: string) {
  const newRoomId = randomUUID();
  chatRooms.set(newRoomId, new Set([ws]));
  console.log(
    "🚀 ~ handleIncomingMessage ~ newRoomId:",
    newRoomId,
    chalk.magenta(chatRooms.size),
  );

  sendMessage(ws, `created room with id ${newRoomId}`, user);
}

function joinChatRoom(ws: WebSocket, message: Message) {
  const roomId = message.payload.roomId;

  const chatRoom = chatRooms.get(roomId);
  if (!chatRoom) {
    sendMessage(ws, `Room id ${roomId} not exist`);
    return;
  }

  chatRoom.add(ws);

  console.log(chalk.bgCyan(chatRoom.size));
}

function broadcastMessageInChatRoom(
  ws: WebSocket,
  message: Message,
  tokenData: { user: string },
) {
  const roomId = message.payload.roomId;

  const chatRoom = chatRooms.get(roomId);
  if (!chatRoom) {
    sendMessage(ws, `Room id ${roomId} not exist`);
    return;
  }

  // broadcast message to all clients joined to room
  chatRoom.forEach((client) => {
    if (client.readyState === client.OPEN) {
      sendMessage(client, message.payload.content, ` by ${tokenData.user}`);
    }
  });
}

function leaveChatRoom(
  ws: WebSocket,
  message: Message,
  tokenData: { user: string },
) {
  const roomId = message.payload.roomId;

  const clients = chatRooms.get(roomId);

  // leave chat room
  clients?.delete(ws);

  // broadcast leave message to all existing client in chat room
  clients?.forEach((client) => {
    if (client.readyState === client.OPEN) {
      sendMessage(client, `Room left`, ` by ${tokenData.user}`);
    }
  });
}

function sendMessage(ws: WebSocket, message: string, username?: string) {
  if (ws.readyState === ws.OPEN) {
    ws.send(`${message} ${username ? username : ""}`);
  }
}

function parseRawData(rawData: ws.RawData) {
  return rawData.toString("utf-8");
}

function authenticateUser(token: string) {
  try {
    const decodedToken = Buffer.from(token, "base64").toString();
    console.log("🚀 ~ authenticateUser ~ decodedToken:", decodedToken);
    const tokenData = JSON.parse(decodedToken);
    console.log("🚀 ~ authenticateUser ~ tokenData:", tokenData);

    if (!tokenData.user) {
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
