import {ServerHandler} from "../socket/ServerHandler";
import type {Server, Socket} from "socket.io";

type ChatHandler = {
    join: {
        name: string;
    },
    leave: null,
    message: {
        message: string;
    },
    disconnect: null
}

type ChatRoomHandler = {
    create: {
        name: string;
    },
    getRooms: null
}

export class ServerChatRoomHandler extends ServerHandler<ChatRoomHandler> {
    rooms = new Map<string, ServerChatHandler>();


    listenToChatRoom(io: Server, room: ServerChatHandler) {
        const listener = (socket: Socket) => {
            room.registerSocket(io, socket);
        };

        io.on("connection", listener);

        room.whenClosing(() => {
            console.log(room.roomName + " closing room")
            this.rooms.delete(room.roomName);
            io.off("connection", listener);
            io.to(this.nameSpace).emit("rooms", Array.from(this.rooms.keys()));
        });
    }

    constructor() {
        super("chatRoom", {
            create: ({name}, socket, io) => {
                if (this.rooms.has(name)) {
                    return;
                } else {
                    const room = new ServerChatHandler(name, true);
                    this.rooms.set(room.roomName, room);
                    this.listenToChatRoom(io, room);

                    io.to(this.nameSpace).emit("rooms", Array.from(this.rooms.keys()));
                    console.log(name + " room created");
                }
            },
            getRooms: (data, socket, io) => {
                socket.emit("rooms", Array.from(this.rooms.keys()));
                socket.join(this.nameSpace);
            }
        });
    }
}


export class ServerChatHandler extends ServerHandler<ChatHandler> {
    // socket.id -> name
    private userSockets = new Map<string, string>();

    constructor(public readonly roomName: string = "general", private temporary: boolean = false) {
        super(`chat:${roomName}`, {
            join: ({name}, socket, io) => {
                // if (roomName !== this.roomName) {
                //     return;
                // }
                // user already in room
                if (this.userSockets.has(socket.id)) {
                    return;
                }

                if (this.userNameTaken(name)) {
                    this.setClientName(socket, this.generateRandomUserName());
                } else {
                    this.setClientName(socket, name);
                }
                this.joinRoom(socket, this.roomName);
            },
            leave: (data, socket, io) => {
                this.leaveRoom(socket);
            },
            message: (data, socket, io) => {
                if (!this.userExists(socket)) {
                    this.setClientName(socket, this.generateRandomUserName());
                    this.joinRoom(socket, this.roomName);
                }
                this.sendMessage(socket, data.message);
            },
            disconnect: (data, socket, io) => {
                this.leaveRoom(socket);
            }
        });

        if (temporary) {
            // if it is temporary and somebody created it, but didn't join it, it will be deleted after 1 minute
            setTimeout(() => {
                if (this.userSockets.size === 0)
                    this.closeCallback();
            }, 1000 * 60);
        }
    }

    private closeCallback = () => {
    };

    whenClosing(callback: () => void) {
        this.closeCallback = callback;
    }

    generateRandomUserName(): string {
        return `User ${Math.round(Math.random() * 999999)}`;
    }

    joinRoom(socket: Socket, room: string) {
        socket.join(room);
    }

    leaveRoom(socket: Socket) {
        const user = this.getUser(socket);
        if (user) {
            console.log(this.roomName + " user left: " + user);
        }
        socket.leave(this.roomName);
        this.unregister(socket);
        this.userSockets.delete(socket.id);
        if (this.userSockets.size === 0 && this.temporary) {
            this.closeCallback();
        }
    }

    setClientName(socket: Socket, name: string) {
        socket.emit("name", name);
        console.log(this.roomName + " new User: " + name);
        this.userSockets.set(socket.id, name);
    }

    userNameTaken(name: string) {
        return Array.from(this.userSockets.values()).includes(name);
    }

    userExists(socket: Socket) {
        return this.userSockets.has(socket.id);
    }

    getUser(socket: Socket) {
        return this.userSockets.get(socket.id);
    }

    sendMessage(socket: Socket, message: string) {
        const user = this.getUser(socket);
        socket.to(this.roomName).emit("message", {message, user, time: Date.now()});
    }

}