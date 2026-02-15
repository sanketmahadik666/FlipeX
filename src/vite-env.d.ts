/// <reference types="vite/client" />

declare module '*?url' {
  const content: string;
  export default content;
}

declare module '*.mp3' {
  const src: string;
  export default src;
}
