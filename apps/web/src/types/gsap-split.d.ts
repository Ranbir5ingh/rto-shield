declare module 'gsap/SplitText' {
  class SplitText {
    readonly words: Element[];
    readonly lines: Element[];
    readonly chars: Element[];
    constructor(target: Element, vars?: { type?: string; mask?: string });
    revert(): void;
  }
  export { SplitText };
}
