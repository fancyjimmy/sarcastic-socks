import type { Server, Socket } from 'socket.io';
import type { ChatHandler, ChatUserInfo, MessageCallback } from './types';
import NamespaceHandler from '../../socket/NamespaceHandler';

const adjectives = [
	'Happy',
	'Sad',
	'Brave',
	'Silly',
	'Clever',
	'Creative',
	'Curious',
	'Eager',
	'Faithful',
	'Fancy',
	'Fierce',
	'Friendly',
	'Funny',
	'Generous',
	'Gentle',
	'Grateful',
	'Great',
	'Happy',
	'Helpful',
	'Honest',
	'Humorous',
	'Innocent',
	'Intelligent',
	'Jolly',
	'Joyful',
	'Kind',
	'Lovely',
	'Lucky',
	'Magical',
	'Merry',
	'Mighty',
	'Modest',
	'Neat',
	'Nifty',
	'Noble',
	'Optimistic',
	'Outgoing',
	'Patient',
	'Peaceful',
	'Perfect',
	'Polite',
	'Proud',
	'Quirky',
	'Quick',
	'Quiet',
	'Radiant',
	'Rational',
	'Reliable',
	'Respectful',
	'Romantic',
	'Sassy',
	'Savvy',
	'Scholarly',
	'Selfless',
	'Sensible',
	'Silly',
	'Sincere',
	'Skilled',
	'Smart',
	'Smooth',
	'Social',
	'Spirited',
	'Sporty',
	'Strong',
	'Stunning',
	'Super',
	'Sweet',
	'Talented',
	'Thoughtful',
	'Thrifty',
	'Tidy',
	'Tough',
	'Trustworthy',
	'Upbeat',
	'Valiant',
	'Vibrant',
	'Victorious',
	'Vigorous',
	'Virtuous',
	'Vital',
	'Warm',
	'Willing',
	'Wise',
	'Witty',
	'Wonderful',
	'Worthy',
	'Young',
	'Zealous'
];

const nouns = [
	'Dog',
	'Cat',
	'Bird',
	'Tree',
	'House',
	'Car',
	'Bike',
	'Boat',
	'Bridge',
	'Book',
	'Chair',
	'City',
	'Computer',
	'Cookie',
	'Country',
	'Desk',
	'Doctor',
	'Door',
	'Dream',
	'Earth',
	'Engineer',
	'Flower',
	'Friend',
	'Fruit',
	'Garden',
	'Guitar',
	'Hat',
	'Heart',
	'Horse',
	'Island',
	'Jacket',
	'Key',
	'Kitten',
	'Laptop',
	'Lawyer',
	'Leaf',
	'Library',
	'Light',
	'Love',
	'Man',
	'Memory',
	'Money',
	'Moon',
	'Mountain',
	'Music',
	'Ocean',
	'Office',
	'Painting',
	'Piano',
	'Pizza',
	'Planet',
	'Queen',
	'Rabbit',
	'Rain',
	'River',
	'Rock',
	'Room',
	'Sandwich',
	'Sea',
	'Ship',
	'Shoe',
	'Sky',
	'Smile',
	'Snow',
	'Song',
	'Soul',
	'Star',
	'Sun',
	'Teacher',
	'Time',
	'Train',
	'Tree',
	'Water',
	'Wave',
	'Woman',
	'World',
	'Yoga',
	'Zebra',
	'Zoo'
];

export default class ServerChatHandler extends NamespaceHandler<ChatHandler, any> {
	// socket.id -> name
	private userSockets = new Map<string, string>();

	private counter = 0;

	constructor(
		io: Server,
		public readonly roomName: string = 'general',
		private temporary: boolean = false,
		private timeOutTime: number = 5 * 1000
	) {
		super(`chat/${roomName}`, io, {
			join: ({ name }, socket, io) => {
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
			},
			leave: (data, socket) => {
				this.leaveRoom(socket);
			},
			message: (data, socket, io) => {
				if (!this.userExists(socket)) {
					this.setClientName(socket, this.generateRandomUserName());
				}
				this.sendMessage(socket, data.message);
			},
			disconnect: (data, socket, io) => {
				this.leaveRoom(socket);
			},
			connect: (data, socket, io) => {}
		});

		if (temporary) {
			// if it is temporary and somebody created it, but didn't join it, it will be deleted after 1 minute
			setTimeout(() => {
				if (this.userSockets.size === 0) {
					this.closeRoom();
				}
			}, this.timeOutTime);
		}
	}

	private closeCallback = () => {};

	private messageCallbacks: Map<number, MessageCallback<any>> = new Map();
	private messageCallbackCounter = 0;

	whenClosing(callback: () => void) {
		this.closeCallback = callback;
	}

	whenMessage(callback: MessageCallback<any>): number {
		let counter = this.messageCallbackCounter++;
		this.messageCallbacks.set(counter, callback);
		return counter;
	}

	removeMessageCallback(id: number) {
		this.messageCallbacks.delete(id);
	}

	private userChangeCallback?: (count: number) => void;

	whenUserChanges(callback: (count: number) => void) {
		this.userChangeCallback = callback;
	}

	generateRandomUserName(): string {
		const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
		const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];

		return `${randomAdjective}${randomNoun}`;
	}

	joinRoom(socket: Socket) {
		socket.join(this.namespaceName);
	}

	leaveRoom(socket: Socket) {
		const user = this.getUser(socket);
		socket.leave(this.namespaceName);
		this.userSockets.delete(socket.id);
		this.emitUsers(socket);
		if (this.userChangeCallback) {
			this.userChangeCallback(this.userCount);
		}
		if (this.userSockets.size === 0 && this.temporary) {
			this.closeRoom();
		}
	}

	closeRoom() {
		this.closeCallback();
		this.unregister(true);
	}

	get userCount() {
		return this.userSockets.size;
	}

	getClientUsers(): ChatUserInfo[] {
		return Array.from(this.userSockets.values()).map((name, index) => ({
			name,
			id: name
		}));
	}

	setClientName(socket: Socket, name: string) {
		this.joinRoom(socket);
		socket.emit('name', name);
		socket.emit('users', this.getClientUsers());
		this.userSockets.set(socket.id, name);
		this.emitUsers(socket);
		if (this.userChangeCallback) {
			this.userChangeCallback(this.userCount);
		}
	}

	userNameTaken(name: string) {
		return Array.from(this.userSockets.values()).includes(name);
	}

	userExists(socket: Socket) {
		return this.userSockets.has(socket.id);
	}

	emitUsers(socket: Socket) {
		socket.to(this.namespaceName).emit('users', this.getClientUsers());
	}

	getUser(socket: Socket) {
		return this.userSockets.get(socket.id);
	}

	sendMessage(socket: Socket, message: string) {
		const user = this.getUser(socket);
		if (!user) {
			throw new Error("User not found, but it shouldn't happen, because it is checked before");
		}
		this.namespace
			.except(socket.id)
			.emit('message', { message, user, time: Date.now(), id: this.counter++ });
		if (this.messageCallbacks) {
			for (const messageCallback of this.messageCallbacks.values()) {
				messageCallback(message, socket, { id: socket.id, name: user });
			}
		}
	}

	broadcastMessage(message: string, user: string, extra?: any) {
		this.namespace.emit('message', { message, user, time: Date.now(), id: this.counter++, extra });
	}
}
