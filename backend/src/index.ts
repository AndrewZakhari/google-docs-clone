import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import dotenv from 'dotenv'; 
import { PrismaClient } from "@prisma/client";
import authRoutes from "./routes/auth";
import documentRoutes from "./routes/documents";
import { setupWebSocket } from "./websocket/socketHandler";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
}})


export const prisma = new PrismaClient();

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);

setupWebSocket(io);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
    console.log("Server is running on port", PORT);
});



