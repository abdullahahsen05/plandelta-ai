import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";

import { Prisma, PrismaClient } from "../generated/prisma/client.js";

function runtimeDatabaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) {
    throw new Error("Invalid environment variables: DATABASE_URL");
  }

  const url = new URL(value);
  url.searchParams.set("uselibpqcompat", "true");
  return url.toString();
}

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: runtimeDatabaseUrl(),
        max: 8,
      }),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  inTransaction<T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.$transaction(operation);
  }
}
