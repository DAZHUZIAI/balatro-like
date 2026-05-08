import { HandType } from '../core/CardType.ts';

export interface PlanetDef {
  id: string;
  name: string;
  description: string;
  cost: number;
  handType: HandType;
}

export const PLANET_CARDS: PlanetDef[] = [
  { id: 'mercury', name: 'Mercury', description: 'Level up High Card', cost: 3, handType: HandType.HighCard },
  { id: 'venus', name: 'Venus', description: 'Level up Pair', cost: 3, handType: HandType.Pair },
  { id: 'earth', name: 'Earth', description: 'Level up Two Pair', cost: 3, handType: HandType.TwoPair },
  { id: 'mars', name: 'Mars', description: 'Level up Three of a Kind', cost: 3, handType: HandType.ThreeOfAKind },
  { id: 'jupiter', name: 'Jupiter', description: 'Level up Straight', cost: 3, handType: HandType.Straight },
  { id: 'saturn', name: 'Saturn', description: 'Level up Flush', cost: 3, handType: HandType.Flush },
  { id: 'uranus', name: 'Uranus', description: 'Level up Full House', cost: 3, handType: HandType.FullHouse },
  { id: 'neptune', name: 'Neptune', description: 'Level up Four of a Kind', cost: 3, handType: HandType.FourOfAKind },
  { id: 'pluto', name: 'Pluto', description: 'Level up Straight Flush', cost: 3, handType: HandType.StraightFlush },
  { id: 'planet_x', name: 'Planet X', description: 'Level up Five of a Kind', cost: 3, handType: HandType.FiveOfAKind },
];
