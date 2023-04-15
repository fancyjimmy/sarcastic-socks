import {ServerHandler} from "../socket/ServerHandler";
import type {LobbyManagingEvents, LobbySettings} from "./types";
import type {Namespace, Server, Socket} from "socket.io";
import {LobbyHandler} from "./LobbyHandler";
import type {TimerOptions} from "./TimeoutPolicy";


type StringTyped = { [key: string]: any };

export class Emitter<T extends StringTyped> {
    emit<K extends keyof T & string>(socket: Socket, event: K, data: T[K]): void {
        socket.emit(event, data);
    }

    broadcast<K extends keyof T & string>(io: Server | Namespace, room: string, event: K, data: T[K]): void {
        io.to(room).emit(event, data);
    }

    broadcastAll<K extends keyof T & string>(io: Server | Namespace, event: K, data: T[K]): void {
        io.emit(event, data);
    }
}

/*
Lobby Making Description

user sends a create request to the LobbyManagerHandler
LobbyManagerHandler creates a new LobbyHandler with a random generated ID
LobbyManager sends the ID back to the user

User will be redirected to the /lobby/[lobbyId] page
he can then join with a name and password
he can send a link with the lobbyId to his friends

any person can join the lobby with the lobbyId and the password
the person then can ask the LobbyManagerHandler to join the lobby
if they can join, they will get a sessionKey to authenticate themselves with it for the lobby





 */


export class LobbyManagerHandler extends ServerHandler<LobbyManagingEvents> {

    private readonly lobbies: Map<string, LobbyHandler> = new Map();

    private generateLobbyId(): string {
        return Date.now().toString(16);
    }

    private createLobby(io: Server, lobbySettings: LobbySettings, timeoutTime: TimerOptions): LobbyHandler {
        const lobby = new LobbyHandler(io, this.generateLobbyId(), lobbySettings, timeoutTime);
        return lobby;
    }

    public instantiateLobby(io: Server, lobbySettings: LobbySettings, timeoutTime: TimerOptions): LobbyHandler {
        const lobby = this.createLobby(io, lobbySettings, timeoutTime);
        this.lobbies.set(lobby.lobbyId, lobby);

        console.log(this.lobbies.keys());

        lobby.inactivityTimer.onReset(() => {
            console.log("reset");
        });

        lobby.inactivityTimer.onTimeout(() => {
            lobby.stop();
        });
        lobby.onStop(() => {
            this.lobbies.delete(lobby.lobbyId);
        });
        lobby.start(io);
        return lobby;
    }


    constructor() {
        super("lobby", {
            create: (data, socket, io) => {
                const [{settings}, cb] = data;

                if (settings.isPrivate && !settings.password) {
                    cb({data: null, success: false, message: "Password is required"});
                    return;
                }

                const lobby = this.instantiateLobby(io, settings, {minutes: 5});

                cb({
                    data: lobby.lobbyId, success: true, message: "Lobby created"
                });

            },
            join: ([{lobbyId, username, password}, response], socket) => {
                const lobby = this.getLobbyFromId(lobbyId);
                if (!lobby) {
                    response({message: "Lobby not found", success: false, data: null});
                    return;
                }

                try {
                    const playerInfo = lobby.tryJoin(socket, username, password);
                    response({message: "", success: true, data: playerInfo});
                } catch (e) {
                    if (e instanceof Error) {
                        response({message: e.message, success: false, data: null});
                        return;
                    }
                    response({message: JSON.stringify(e), success: false, data: null});
                }
            },
            get: ([{lobbyId}, response]) => {
                const lobby = this.getLobbyFromId(lobbyId);
                if (!lobby) {
                    response({message: "Lobby not found", success: false, data: null});
                    return;
                }
                response({message: "", success: true, data: {isPrivate: lobby.settings.isPrivate}});
            }
        });

    }

    getLobbyFromId(lobbyId: string): LobbyHandler | undefined {
        return this.lobbies.get(lobbyId);
    }
}