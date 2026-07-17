declare module "http" {
  interface IncomingMessage {
    correlationId?: string;
  }
}

export {};
