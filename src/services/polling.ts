interface HasModel {
  models: string[];
}

class Poller<T extends HasModel> {
  private items: T[];
  private currentIndex: number;

  constructor(items: T[]) {
    this.items = items;
    this.currentIndex = 0;
  }

  public getNext(model: string): T {
    if (this.items.length === 0) {
      throw new Error("No items to poll.");
    }
    const item = this.items[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.items.length;
    if (!item.models.includes(model)) {
      return this.getNext(model);
    }
    return item;
  }
}

export default Poller;
