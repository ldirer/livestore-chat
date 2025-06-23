/// <reference types="vite/client" />

// https://vite.dev/guide/env-and-mode
interface ViteTypeOptions {
  // By adding this line, you can make the type of ImportMetaEnv strict
  // to disallow unknown keys.
  strictImportMetaEnv: unknown
}

interface ImportMetaEnv {
  readonly VITE_LIVESTORE_SYNC_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}