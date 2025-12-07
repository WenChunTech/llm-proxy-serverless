export class TokenRefresher {
    private task: () => Promise<number | null>;
    private timerId: ReturnType<typeof setTimeout> | null = null;

    constructor(task: () => Promise<number | null>) {
        this.task = task;
    }

    public start(initialDelay: number = 0): void {
        if (this.timerId) {
            console.log("Token refresher is already running.");
            return;
        }
        console.log(`Starting token refresher with an initial delay of ${initialDelay}ms.`);
        this.timerId = setTimeout(() => this.run(), initialDelay);
    }

    private async run(): Promise<void> {
        try {
            const nextDelay = await this.task();
            if (nextDelay !== null && nextDelay > 0) {
                this.timerId = setTimeout(() => this.run(), nextDelay);
            } else {
                this.stop();
                console.log("Token refresher finished its schedule.");
            }
        } catch (error) {
            console.error("Error executing token refresh task:", error);
            this.stop();
        }
    }

    public stop(): void {
        if (this.timerId) {
            clearTimeout(this.timerId);
            this.timerId = null;
            console.log("Token refresher stopped.");
        }
    }
}
