declare module "cloudflare:workers" {
  export interface WorkflowEvent<Params = unknown> {
    payload: Params;
    timestamp: Date;
    instanceId: string;
  }
  export interface WorkflowStepConfig {
    retries?: {
      limit: number;
      delay?: string | number;
      backoff?: "constant" | "linear" | "exponential";
    };
    timeout?: string | number;
  }
  export interface WorkflowStep {
    do<T>(name: string, callback: () => Promise<T>): Promise<T>;
    do<T>(name: string, config: WorkflowStepConfig, callback: () => Promise<T>): Promise<T>;
    sleep(name: string, duration: string | number): Promise<void>;
  }
  export abstract class WorkflowEntrypoint<Env = unknown, Params = unknown> {
    protected env: Env;
    protected ctx: ExecutionContext;
    abstract run(event: WorkflowEvent<Params>, step: WorkflowStep): Promise<unknown>;
  }
  export interface Workflow<Params = unknown> {
    create(options?: { id?: string; params?: Params }): Promise<{ id: string }>;
  }
}
