export type Class<T extends abstract new (...args: any) => any> = {
    new(...args: ConstructorParameters<T>): T;
}
