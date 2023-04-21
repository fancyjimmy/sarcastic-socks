import {Server} from 'socket.io';
import type {Server as HttpServer} from 'http';


import {ServerChatHandler, ServerChatRoomHandler} from "./lib/handler/chat";
import {LobbyManagerHandler} from "./lib/handler/lobby/LobbyManagerHandler";
import logger from "./lib/Logger";
import {DebugHandler} from "./lib/handler/debug";


let g: any[] = [];

console = logger.proxy(console);

const serverHandlers = [
    new ServerChatRoomHandler(),
    new DebugHandler(),
    new LobbyManagerHandler(),
]


export default function injectSocketIO(server: HttpServer) {
    const io = new Server(server, {
        cors: {
            methods: ['GET', 'POST'],
        }
    });

    const serverChatHandler = new ServerChatHandler(io, "general", false)

    const chatRoomNamespace = io.of("/chat/general");
    serverChatHandler.register();

    io.on('connection', (socket) => {
        serverHandlers.forEach(handler => {
                handler.registerSocket(io, socket);
            }
        );
    });

    console.log('SocketIO injected');
}
