/** One face's artwork, as file URLs. Every layer is 1024 × 1434 px. */
export interface MagazineFace {
  print?: string;
  foil?: string;
  deboss?: string;
}

/**
 * A magazine as the About page needs it — plain data, so it can be handed
 * from the server to the viewer. Nothing of Payload's comes through.
 */
export interface MagazineData {
  name: string;
  stock: { label: string; short: string; color: string };
  foil: { label: string; color: string };
  finish: string;
  envelope: string;
  insideMessage: string;
  front: MagazineFace & { dieCut?: string };
  insideLeft: MagazineFace;
  insideRight: MagazineFace;
  back: MagazineFace;
}
