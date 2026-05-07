/** Canvas dimensions */
export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;

/** Card rendering */
export const CARD_WIDTH = 70;
export const CARD_HEIGHT = 98;
export const CARD_RADIUS = 8;

/** Hand (poker hand scoring) */
export const HAND_BASE_CHIPS: Record<string, number> = {
  high_card: 5,
  pair: 10,
  two_pair: 20,
  three_of_a_kind: 30,
  straight: 30,
  flush: 35,
  full_house: 40,
  four_of_a_kind: 60,
  straight_flush: 100,
  five_of_a_kind: 120,
};

export const HAND_BASE_MULT: Record<string, number> = {
  high_card: 1,
  pair: 1,
  two_pair: 2,
  three_of_a_kind: 3,
  straight: 4,
  flush: 4,
  full_house: 4,
  four_of_a_kind: 7,
  straight_flush: 8,
  five_of_a_kind: 12,
};
