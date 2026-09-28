/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_S2S_URL?: string;
  readonly VITE_WARMUP_URL?: string;
  readonly VITE_SAVE_URL?: string;
  readonly VITE_LIST_URL?: string;
  readonly VITE_GLOSSARY_ADD_URL?: string;
  readonly VITE_GLOSSARY_LIST_URL?: string;
  readonly VITE_SAVE_POSITION_URL?: string;
  readonly VITE_GET_POSITION_URL?: string;
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
  readonly VITE_MOCK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
