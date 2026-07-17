import { Global, Module } from "@nestjs/common";

import { LocalStorageProvider } from "./local-storage.provider.js";
import { OBJECT_STORAGE } from "./storage.types.js";

@Global()
@Module({
  providers: [
    LocalStorageProvider,
    {
      provide: OBJECT_STORAGE,
      useExisting: LocalStorageProvider,
    },
  ],
  exports: [OBJECT_STORAGE, LocalStorageProvider],
})
export class StorageModule {}
