export class TokenRefresher {
    private task: () => Promise<void>;
    private interval: number;
    private timerId: number | null = null;

    constructor(task: () => Promise<void>, interval: number) {
        this.task = task;
        this.interval = interval;
    }

    public start(): void {
        if (this.timerId) {
            console.log("Token refresher is already running.");
            return;
        }
        console.log(`Starting token refresher with an interval of ${this.interval}ms.`);
        this.timerId = setInterval(async () => {
            try {
                await this.task();
            } catch (error) {
                console.error("Error executing token refresh task:", error);
            }
        }, this.interval);
    }

    public stop(): void {
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
            console.log("Token refresher stopped.");
        }
    }
}