export {};

declare global {
  namespace YT {
    type PlayerEvent = { target: Player };
    type OnStateChangeEvent = { target: Player; data: number };

    class Player {
      constructor(element: HTMLElement | string, options: PlayerOptions);
      destroy(): void;
      getCurrentTime(): number;
      getDuration(): number;
      getIframe(): HTMLIFrameElement;
      seekTo(seconds: number, allowSeekAhead: boolean): void;
    }

    type PlayerOptions = {
      videoId: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (event: PlayerEvent) => void;
        onStateChange?: (event: OnStateChangeEvent) => void;
      };
    };

    const PlayerState: {
      PLAYING: number;
      PAUSED: number;
      ENDED: number;
    };
  }

  interface Window {
    YT?: typeof YT;
    onYouTubeIframeAPIReady?: () => void;
  }
}
