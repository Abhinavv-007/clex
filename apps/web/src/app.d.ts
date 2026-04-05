declare global {
  namespace App {
    interface Locals {
      googleAccessToken?: string
    }
    interface Platform {
      env?: Record<string, unknown>
      context?: ExecutionContext
    }
    // interface Error {}
    // interface PageData {}
    // interface PageState {}
  }
}

export {}
