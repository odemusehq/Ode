// Globals of Max's v8 JavaScript object and the Node for Max module used by the Ode device.

declare class LiveAPI {
  constructor(path?: string);
  constructor(callback: (args: unknown[]) => void, path?: string);
  path: string;
  readonly id: number | string;
  property: string;
  get(property: string): unknown[];
  set(property: string, ...values: unknown[]): void;
  call(name: string, ...args: unknown[]): unknown;
  getcount(child: string): number;
  goto(path: string): void;
}

declare class Task {
  constructor(callback: () => void, owner?: unknown);
  interval: number;
  repeat(times?: number, initialDelayMs?: number): void;
  schedule(delayMs?: number): void;
  cancel(): void;
}

declare function outlet(index: number, ...values: unknown[]): void;
declare function post(...values: unknown[]): void;

declare module "max-api" {
  const maxApi: {
    addHandler(name: string, handler: (...args: unknown[]) => void): void;
    outlet(...values: unknown[]): Promise<void>;
    post(...values: unknown[]): Promise<void>;
  };
  export default maxApi;
}
