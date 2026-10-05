export type Track = {
  id: string;
  source: string;
  title: string;
  artist: string;
  artworkUrl?: string;
  streamUrl: string;
  downloadUrl?: string;
  licenseUrl?: string;
  duration?: number;
  downloadable: boolean;
  /** Source has metadata only and no playable audio in-app — offer a link out
   *  instead of a play button. Set for YouTube links and unknown URLs. */
  externalOnly?: boolean;
};

export interface TrackSource {
  readonly name: string;
  search(query: string): Promise<Track[]>;
  /** For pasted links. Returns a non-downloadable track when the source
   *  cannot legally provide audio. */
  resolve(rawUrl: string): Promise<Track | null>;
  /** Open externally — "search on YouTube" for a pasted link. */
  webUrl(track: Track): string;
}