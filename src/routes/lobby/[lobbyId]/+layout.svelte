<script lang="ts">
  import { onMount, SvelteComponent } from "svelte";
  import { Socket } from "socket.io-client";
  import { io } from "$lib/WebsocketConnection";
  import type { GeneralLobbyInfo, Response } from "../../../../src-socket-io/lib/handler/lobby/manage/types";
  import { getLobbyConnection, getSessionStorage, setSessionStorage } from "../../../lib/lobby/LobbyConnection";
  import Chat from "$lib/components/chat/Chat.svelte";
  import ServerMessage from "../../../lib/components/lobby/lobbyPage/ServerMessage.svelte";
  import type { GeneralPlayerInfo, PlayerInfo } from "../../../../src-socket-io/lib/handler/lobby/types";
  import type { JoinInfo } from "../../../../src-socket-io/lib/handler/lobby/LobbyHandler";
  import PlayerListComponent from "../../../lib/components/lobby/lobbyPage/PlayerListComponent.svelte";
  import Dialog from "$lib/components/lobby/Dialog.svelte";
  import LoadingScreen from "../../../lib/components/lobby/lobbyPage/LoadingScreen.svelte";
  import ErrorScreen from "../../../lib/components/lobby/lobbyPage/ErrorScreen.svelte";
  import LobbySettingsComponent from "../../../lib/components/lobby/lobbyPage/LobbySettingsComponent.svelte";
  import CondensedMessage from "../../../lib/components/lobby/lobbyPage/CondensedMessage.svelte";
  import { gameName, playerState, role, username } from "../../../lib/components/lobby/gameStore";

  export let data;

  let loadingState: "loading" | "error" | "success" = "loading";


  async function isPasswordAuthenticated() {
    return new Promise((resolve, reject) => {
      io.emit(
        "lobby:get",
                {lobbyId: data.lobbyId},
                (response: Response<Partial<GeneralLobbyInfo>>) => {
                    if (response.success === false) {
                        reject(response);
                        return;
                    }
                    if (response.data.authenticationPolicyType === 'password') {
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                }
            );
        });
    }

    async function serverAuthentication(
        username: string,
        password: string,
        lobbyId: string = data.lobbyId
    ): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            io.emit('lobby:join', {username, password, lobbyId}, (response: Response<string>) => {
                if (response.success) {
                    resolve(response.data);
                } else {
                    reject(response);
                }
            });
        });
    }

    async function join(): Promise<string> {
        let passwordAuthenticated = await isPasswordAuthenticated();

        let name;
        while (!name) {
            name = prompt('Please enter your name');
        }
        let password = null;
        if (passwordAuthenticated) {
            password = prompt('Please enter your password');
        }
        try {
            return await serverAuthentication(name, password);
        } catch (e) {
            throw e;
        }
    }


    function setGame(name: string | null) {
        setSessionStorage(data.lobbyId, "game", name);
        $gameName = name;
    }

    async function loadData(socket: Socket): Promise<JoinInfo> {
        return new Promise<JoinInfo>((resolve, reject) => {
            socket.emit('joined', (data) => {
                resolve(data as JoinInfo);
            });

            socket.once('error', (data) => {
                reject(data);
            });
            setTimeout(() => {
                console.log("hello");
                reject({message: 'LOBBY NOT FOUND'});
            }, 1000);
        });
    }

    let players: GeneralPlayerInfo[] = [];

    let self = {
        username: '',
        role: ''
    };

    async function setPlayerData(playerInfos: PlayerInfo[]) {
        players = playerInfos;

        playerInfos.forEach((player) => {
            if (player.username === self.username) {
                $role = player.role;
                self = {
                    username: player.username,
                    role: player.role
                };
            }
        });

    }

    function initSocketEvents(socket: Socket) {
        socket.on('playerChanged', (change) => {
            setPlayerData(change.players);
        });


        socket.on("game-chosen", (game: { url: string }) => {
            $playerState = "initializing";
            setGame(game.url);
        });

        socket.on("game-started", () => {
            if ($playerState === "initializing") {
                $playerState = "playing";
            }
        });

        socket.on("game-canceled", () => {
            $playerState = "lobby";
            setGame(null);
        });

        socket.on("game-ended", () => {
            $playerState = "lobby";
            setGame(null);
        });

        socket.on('disconnect', () => {
            loadingState = 'error';
            error = {message: 'Disconnected'};
        });
    }

    let socket: Socket;
    let maxPlayers = 0;


    let error = null;

    onMount(async () => {
        io.on('error', (err) => {
            loadingState = 'error';
            error = err.message;
        });
        let token = getSessionStorage(data.lobbyId, 'sessionKey');
        if (!token) {
            try {
                let authToken = await join();
                setSessionStorage(data.lobbyId, 'sessionKey', authToken);
                token = authToken;
            } catch (e) {
                loadingState = 'error';
                error = e;
                return;
            }
        }

        socket = getLobbyConnection(data.lobbyId, token);

        try {
          const initData: JoinInfo = await loadData(socket);
          joinInfo = initData;
          players = initData.players;
          $gameName = initData.game;
          $username = initData.username;
          $role = initData.role;
          // TODO FIX THE ZOD OBJECT TO ENUM
          $playerState = initData.state || "lobby";

          chatRoomId = initData.chatRoomId;
          maxPlayers = initData.maxPlayers;

          initSocketEvents(socket);
          loadingState = "success";
        } catch (e) {
          loadingState = "error";
          error = e;
        }
    });

  let lobbyId = "";
  let usedName = "";


  function kick(player: GeneralPlayerInfo) {
    socket.emit("kick", player.username, (response: Response<null>) => {
      if (response.success === false) {
        alert(response.message);
      }
    });
  }


    let chatRoomId;
    let dialog;
    let dialogComponent: SvelteComponent;
    let dialogArgs: any = {};

    let onResolve: (...args: any) => void;

    async function openDialog(element: SvelteComponent, args: any, resolveCallback: (...args: any) => void): Promise<any[]> {
        return new Promise<any[]>((resolve, reject) => {
            dialogComponent = element;
            dialogArgs = args;
            onResolve = (...args: any[]) => {
                resolveCallback(...args);
                resolve(args);
            };
            dialog.open();
        });
    }

    let joinInfo;
</script>

<div class="w-screen h-screen">
    <div class="w-full h-full">
        {#if loadingState === 'loading'}
            <LoadingScreen/>
        {:else if loadingState === 'error'}
            <ErrorScreen {error} lobbyId={data.lobbyId}></ErrorScreen>
        {:else}
            <div class="w-full h-full bg-slate-800 relative grid grid-cols-[3fr,1fr]">
                <div class="flex flex-col">
                    <div class="max-w-full relative h-full">
                        <slot/>
                    </div>
                </div>

                <div class="flex flex-col min-h-0">
                    <div class="p-2">

                        <LobbySettingsComponent {self} {joinInfo}></LobbySettingsComponent>
                        <div class="bg-slate-800 w-full mt-1">

                            <PlayerListComponent players={players} {self} maxPlayers={maxPlayers}
                                                 on:kick={(event) => {kick(event.detail)}}/>
                        </div>
                    </div>

                  <Chat
                    room={chatRoomId}
                    user={$username}
                    class="flex-1 min-w-[25em]"
                    userComponent={null}
                    messageFormatter={(message) => {
						if (message.extra?.server === true) {
							return ServerMessage;
						}
                        return CondensedMessage;
					}}
                  >
                    <p slot="icon" />
                  </Chat>
                </div>

            </div>
        {/if}
    </div>
</div>

<Dialog args={dialogArgs} bind:this={dialog} element={dialogComponent} on:resolve={(event) => {
    onResolve(event.detail);
    dialog.close();
}}/>
