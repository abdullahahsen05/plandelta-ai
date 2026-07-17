import { Global, Module } from "@nestjs/common";
import { S3Client } from "@aws-sdk/client-s3";

import { LocalStorageProvider } from "./local-storage.provider.js";
import { S3_CLIENT, S3StorageProvider } from "./s3-storage.provider.js";
import { OBJECT_STORAGE } from "./storage.types.js";

@Global()
@Module({
  providers: [
    LocalStorageProvider,
    {
      provide: S3_CLIENT,
      useFactory: () =>
        new S3Client({
          region: process.env.S3_REGION ?? process.env.AWS_REGION ?? "us-east-1",
        }),
    },
    S3StorageProvider,
    {
      provide: OBJECT_STORAGE,
      inject: [LocalStorageProvider, S3StorageProvider],
      useFactory: (local: LocalStorageProvider, s3: S3StorageProvider) =>
        process.env.STORAGE_PROVIDER?.toLowerCase() === "s3" ? s3 : local,
    },
  ],
  exports: [OBJECT_STORAGE, LocalStorageProvider, S3StorageProvider],
})
export class StorageModule {}
