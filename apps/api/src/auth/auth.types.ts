export type AuthContext = {
  userId: string;
  role: string;
  email?: string;
};

declare module "http" {
  interface IncomingMessage {
    auth?: AuthContext;
  }
}
