import express from "express";
import http from "http";
import { startWebsocketServer } from "./websocketServer.ts";

const app = express();
const server = http.createServer(app);

// start ws server
startWebsocketServer(server);

const PORT = 3000;
server
  .listen(PORT, () => {
    console.log(`Server is listening at http://localhost:${PORT}`);
  })
  .on("error", (err) => {
    console.error(`Server failed to start on port ${PORT}:`, err.message);
  });
