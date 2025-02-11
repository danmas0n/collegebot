declare module 'node-html-parser' {
  export interface HTMLElement {
    querySelector(selector: string): HTMLElement | null;
    querySelectorAll(selector: string): HTMLElement[];
    getAttribute(name: string): string | null;
    textContent: string | null;
  }

  export function parse(html: string): HTMLElement;
}
