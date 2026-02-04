import express from "express";
import http from "http";
import { startWebsocketServer } from "./websocketServer.ts";

const app = express();
const server = http.createServer(app);

// start ws server
startWebsocketServer(server);

// create dummy user
const user1 = Buffer.from(JSON.stringify({ user: "AppleG" })).toString(
  "base64",
);
const user2 = Buffer.from(JSON.stringify({ user: "MangoG" })).toString(
  "base64",
);
const user3 = Buffer.from(JSON.stringify({ user: "KafalG" })).toString(
  "base64",
);
const user4 = Buffer.from(JSON.stringify({ user: "Grapes" })).toString(
  "base64",
);

const PORT = 3000;
server
  .listen(PORT, () => {
    console.log(`Server is listening at http://localhost:${PORT}`);
  })
  .on("error", (err) => {
    console.error(`Server failed to start on port ${PORT}:`, err.message);
  });
