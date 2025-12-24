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

    const maxAttempts = this.items.length;
    for (let i = 0; i < maxAttempts; i++) {
      const item = this.items[this.currentIndex];
      this.currentIndex = (this.currentIndex + 1) % this.items.length;
      if (item.models.includes(model)) {
        return item;
      }
    }

    throw new Error(`No provider found for model: ${model}`);
  }
}

export default Poller;
