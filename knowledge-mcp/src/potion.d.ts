declare module "@yarflam/potion-base-32m" {
  export function embed(text: string): Promise<Float32Array[]>;
}

declare module "sqlite-vec" {
  export function load(db: any): void;
}
