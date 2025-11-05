
class Poller<T> {
    private items: T[];
    private currentIndex: number;

    constructor(items: T[]) {
        this.items = items;
        this.currentIndex = 0;
    }

    public getNext(): T {
        if (this.items.length === 0) {
            throw new Error("No items to poll.");
        }

        const item = this.items[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.items.length;
        return item;
    }
}

export default Poller;
