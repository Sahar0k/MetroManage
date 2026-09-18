/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly PB_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
