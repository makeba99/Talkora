declare module "playwright" {
  export const chromium: {
    launchPersistentContext(userDataDir: string, options?: object): Promise<{
      pages(): Array<{ url(): string; goto(url: string, opts?: object): Promise<unknown> }>;
      newPage(): Promise<{ url(): string; goto(url: string, opts?: object): Promise<unknown> }>;
      close(): Promise<void>;
    }>;
  };
}
