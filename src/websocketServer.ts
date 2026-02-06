import chalk from "chalk";
import jwt, { type JwtPayload } from "jsonwebtoken";
import type { IncomingMessage, Server } from "http";
import { parse as parseUrl } from "url";
import ws, { WebSocket, WebSocketServer } from "ws";
import { prisma } from "./lib/prisma.ts";

const connectedClients: Map<string, WebSocket> = new Map();
const chatRooms: Map<string, Set<WebSocket>> = new Map();

type MessageType = "CREATE" | "JOIN" | "LEAVE" | "MESSAGE" | "TYPING";
interface Message {
  type: MessageType;
  payload: any;
  timestamp: Date;
}

interface TokenData {
  userId: string;
  username: string;
}

export function startWebsocketServer(server: Server) {
  const wss = new WebSocketServer({ server });

  // wss connection
  wss.on("connection", async (ws: WebSocket, req) => {
    console.log(chalk.green.bold("Connection Connected"));

    // verify token
    const token = extractToken(req);
    const tokenData = authenticateUser(token!);
    if (!tokenData) {
      ws.close(4001, "Unauthenticated user");
      return;
    }

    // send tokenData back to user
    sendToClient(ws, `${tokenData.username}`);

    // set new userId with corresponding ws to track connected client/users
    if (!connectedClients.has(tokenData.userId)) {
      connectedClients.set(`${tokenData.userId}`, ws);
    }

    // listen message
    ws.on("message", (rawData) => {
      const data = parseRawData(rawData);

      handleIncomingMessage(ws, data, tokenData);
    });

    ws.on("error", (error) => {
      console.log(chalk.red.bold("WebSocket encountered an error: \n "), error);
    });

    ws.on("close", () => {
      console.log("Close ", tokenData.username);
      console.log(chalk.red.bold("Connection Closed"));

      for (let [_, clients] of chatRooms) {
        clients.delete(ws);
      }

      connectedClients.delete(tokenData.userId);
    });
  });
}

async function handleIncomingMessage(
  ws: WebSocket,
  data: string,
  tokenData: TokenData,
) {
  const message: Message = JSON.parse(data);

  switch (message.type as MessageType) {
    case "CREATE":
      await createChatRoom(ws, tokenData);
      break;

    case "JOIN":
      joinChatRoom(ws, message, tokenData);
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

async function createChatRoom(ws: WebSocket, tokenData: TokenData) {
  // create new chat room
  console.log("Token data inside create chat room ", tokenData);

  const newChatRoom = await prisma.chat.create({
    data: {
      ownerId: tokenData.userId,
      chatMembers: {
        create: {
          userId: tokenData.userId,
          role: "ADMIN",
        },
      },
    },
    select: {
      id: true,
      createdAt: true,
      owner: {
        select: {
          id: true,
          username: true,
        },
      },
      chatMembers: {
        select: {
          user: {
            select: {
              id: true,
              username: true,
            },
          },
          role: true,
        },
      },
    },
  });

  chatRooms.set(newChatRoom.id, new Set([ws]));
  sendToClient(ws, `created room with id ${newChatRoom.id}`, tokenData.userId);
}

async function joinChatRoom(
  ws: WebSocket,
  message: Message,
  tokenData: TokenData,
) {
  const roomId = message.payload.roomId;

  // check room exits in DB
  const chatRecord = await prisma.chat.findUnique({
    where: {
      id: roomId,
    },
    select: {
      id: true,
      owner: {
        select: {
          id: true,
          username: true,
        },
      },
      chatMembers: {
        select: {
          user: {
            select: {
              id: true,
              username: true,
            },
          },
          role: true,
        },
      },
      messages: {
        select: {
          id: true,
          content: true,
          createdAt: true,
          sender: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      },
    },
  });
  if (!chatRecord) {
    sendToClient(ws, `Room id ${roomId} does not exist`);
    return;
  }

  // check if user is already member
  const isMember = await prisma.chatMembers.findFirst({
    where: {
      chatId: roomId,
      userId: tokenData.userId,
    },
  });

  // add user as MEMBER
  if (!isMember) {
    await prisma.chatMembers.create({
      data: {
        chatId: roomId,
        userId: tokenData.userId,
        role: "MEMBER",
      },
    });
  }

  if (!chatRooms.get(roomId)) {
    chatRooms.set(roomId, new Set());
  }

  chatRooms.get(roomId)?.add(ws);

  console.log(`>> Room ${roomId} size: ${chatRooms.get(roomId)!.size}`);

  sendToClient(ws, `Joined room ${roomId}`, tokenData.username);
}

async function broadcastMessageInChatRoom(
  ws: WebSocket,
  message: Message,
  tokenData: TokenData,
) {
  const roomId = message.payload.roomId;

  const chatRoom = chatRooms.get(roomId);
  if (!chatRoom) {
    sendToClient(ws, `Room id ${roomId} not exist`);
    return;
  }

  const isMember = await prisma.chatMembers.findFirst({
    where: {
      chatId: roomId,
      userId: tokenData.userId,
    },
  });
  if (!isMember) {
    sendToClient(ws, "Forbidden : You are not a member in room");
    return;
  }

  // broadcast message to all clients joined to room
  chatRoom.forEach((client) => {
    if (client.readyState === client.OPEN) {
      sendToClient(client, message.payload.content, ` by ${tokenData.userId}`);
    }
  });

  // store to db
  await prisma.message.create({
    data: {
      senderId: tokenData.userId,
      chatId: roomId,
      content: message.payload.content,
    },
  });
}

function leaveChatRoom(ws: WebSocket, message: Message, tokenData: TokenData) {
  const roomId = message.payload.roomId;

  const clients = chatRooms.get(roomId);

  // leave chat room
  clients?.delete(ws);

  if (clients?.size === 0) {
    chatRooms.delete(roomId);
  }

  // broadcast leave message to all existing client in chat room
  clients?.forEach((client) => {
    if (client.readyState === client.OPEN) {
      sendToClient(client, `Room left`, ` by ${tokenData.username}`);
    }
  });
}

function sendToClient(ws: WebSocket, message: string, username?: string) {
  if (ws.readyState === ws.OPEN) {
    ws.send(`${message} ${username ? username : ""}`);
  }
}

function parseRawData(rawData: ws.RawData) {
  return rawData.toString("utf-8");
}

function authenticateUser(token: string) {
  try {
    const JWT_SECRET = process.env.JWT_SECRET!;

    const decodedToken = jwt.verify(token, JWT_SECRET) as JwtPayload;

    const tokenData = {
      userId: decodedToken.userId,
      username: decodedToken.username,
    };

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
  const token = url.query.token as string;

  return token;
}

// function startCounter(ws: WebSocket, count: number) {
//   return setInterval(() => {
//     ws.send(`count ${count++}`);
//   }, 2000);
// }
