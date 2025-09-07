// backend/src/websocket/socketHandler.ts
import { Server, Socket } from "socket.io";
import * as Y from "yjs";
import { prisma } from "../index";
import jwt from "jsonwebtoken";

const documents = new Map<string, Y.Doc>();
const documentRooms = new Map<string, Set<string>>(); 

interface SocketData {
    userId: string;
    email: string;
}

export function setupWebSocket(io: Server) {
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if(!token) {
                return next(new Error("Authentication error"));
            }
            const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; email: string; };
            socket.data.userId = decoded.userId;
            socket.data.email = decoded.email;
            next();
        } catch (err) {
            return next(new Error("Authentication error")); 
        }
    });

    io.on("connection", (socket: Socket) => {
        console.log('User connected:', socket.data.userId); 
        
        socket.on('join-document', async (documentId: string) => { 
            try {
                const hasAccess = await checkDocumentAccess(
                    documentId,
                    socket.data.userId
                );

                if(!hasAccess) {
                    socket.emit("error", { message: "Access denied"});
                    return;
                }

                socket.join(documentId);

                let ydoc = documents.get(documentId);
                if(!ydoc) {
                    ydoc = new Y.Doc();
                    documents.set(documentId, ydoc);

                    const doc = await prisma.document.findUnique({
                        where: {id: documentId}
                    });

                    if (doc?.yjsState) {
                        Y.applyUpdate(ydoc, doc.yjsState);
                    }
                }

                if(!documentRooms.has(documentId)){
                    documentRooms.set(documentId, new Set());
                }
                documentRooms.get(documentId)!.add(socket.id);

                const state = Y.encodeStateAsUpdate(ydoc);
                socket.emit("sync-update", state);

                const users = Array.from(documentRooms.get(documentId)!).map(socketId => { 
                    const s = io.sockets.sockets.get(socketId);
                    return s ? {
                        id: s.data.userId,
                        email: s.data.email
                    }: null;
                }).filter(Boolean);

                socket.emit('users-update', users);
                socket.to(documentId).emit('user-joined', { 
                    id: socket.data.userId,
                    email: socket.data.email
                });
            } catch (err) {
                console.error("Error joining document:", err);
                socket.emit("error", {message: "Failed to join document"});
            }
        });

        socket.on('send-update', async (documentId: string, update: Uint8Array) => {
            try {
                const ydoc = documents.get(documentId);
                if(!ydoc) return;

                Y.applyUpdate(ydoc, update);

                socket.to(documentId).emit('receive-update', update);

                await saveDocument(documentId, ydoc);

            } catch (err) {
                console.error("Error applying updates:", err);
            }
        });

        socket.on('cursor-update', (documentId: string, cursor: any) => {
            socket.to(documentId).emit('cursor-update', {
                ...cursor,
                userId: socket.data.userId
            });
        });

        socket.on('leave-document', (documentId: string) => {
            socket.leave(documentId);
            const room = documentRooms.get(documentId);
            if(room) {
                room.delete(socket.id);
                if (room.size === 0) {
                    documentRooms.delete(documentId);
                }
            }

            socket.to(documentId).emit('user-left', {
                id: socket.data.userId, 
            });
        });

        socket.on('disconnect', () => {
            documentRooms.forEach((users, documentId) => { 
                if(users.has(socket.id)) {
                    users.delete(socket.id);
                    socket.to(documentId).emit('user-left', {
                        id: socket.data.userId,
                    });
                }
            });
        });
    });
}

async function checkDocumentAccess(documentId: string, userId: string) {
    const doc = await prisma.document.findFirst({ 
        where: {
            id: documentId,
            OR: [
                {ownerId: userId},
                { collaborators: {some: {userId}}},
                { isPublic: true }
            ]
        }
    });
    return !!doc;
}

async function saveDocument(documentId: string, ydoc: Y.Doc) {
    const state = Y.encodeStateAsUpdate(ydoc);
    await prisma.document.update({
        where: {id: documentId},
        data: {
            yjsState: Buffer.from(state),
            updatedAt: new Date()
        }
    });
}