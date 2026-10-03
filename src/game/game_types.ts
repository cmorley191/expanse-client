import { nullopt, opt, Optional } from "../core/optional";

export enum SectorId {
  Inner = 0,
  Belt = 1,
  Outer = 2,
};
export type Sector = {
  id: SectorId,
  name: string,
};
export const sectors: [Sector, Sector, Sector] = [
  { id: SectorId.Inner, name: "Inner Planets" },
  { id: SectorId.Belt, name: "The Belt" },
  { id: SectorId.Outer, name: "Outer Planets" },
]

export enum BandId {
  Inner = 0,
  Belt = 1,
  Jupiter = 2,
  Saturn = 3,
};
export type Band = {
  id: BandId,
  name: string,
  sector: SectorId,
};
export const bands: [Band, Band, Band, Band] = [
  { id: BandId.Inner, name: "Inner Planets", sector: SectorId.Inner },
  { id: BandId.Belt, name: "The Belt", sector: SectorId.Belt },
  { id: BandId.Jupiter, name: "Jupiter", sector: SectorId.Outer },
  { id: BandId.Saturn, name: "Saturn", sector: SectorId.Outer },
];

export enum OrbitalId {
  Earth = 0,
  Mars = 1,
  Ceres = 2,
  Tycho = 3,
  Eros = 4,
  Thoth = 5,
  Jupiter = 6,
  Saturn = 7,
};
export type Orbital = {
  id: OrbitalId,
  name: string,
  band: BandId,
};
export const orbitals: Orbital[] = [
  { id: OrbitalId.Earth, name: "Earth", band: BandId.Inner },
  { id: OrbitalId.Mars, name: "Mars", band: BandId.Inner },
  { id: OrbitalId.Ceres, name: "Ceres", band: BandId.Belt },
  { id: OrbitalId.Tycho, name: "Tycho", band: BandId.Belt },
  { id: OrbitalId.Eros, name: "Eros", band: BandId.Belt },
  { id: OrbitalId.Thoth, name: "Thoth", band: BandId.Belt },
  { id: OrbitalId.Jupiter, name: "Jupiter", band: BandId.Jupiter },
  { id: OrbitalId.Saturn, name: "Saturn", band: BandId.Saturn },
];

export enum ResourceId {
  Food = 0,
  Water = 1,
  Minerals = 2,
  Tech = 3,
};
export type Resource = {
  id: ResourceId,
  name: string,
};
export const resources: Resource[] = [
  { id: ResourceId.Food, name: "Food" },
  { id: ResourceId.Water, name: "Water" },
  { id: ResourceId.Minerals, name: "Minerals" },
  { id: ResourceId.Tech, name: "Tech" },
];

export enum BaseId {
  Eurasia = 0,
  Africa = 1,
  MarinerValley = 2,
  LondresNova = 3,
  Ceres = 4,
  Tycho = 5,
  Eros = 6,
  Thoth = 7,
  Europa = 8,
  Ganymede = 9,
  Rhea = 10,
  Titan = 11,
};
export type Base = {
  id: BaseId,
  name: string,
  orbital: OrbitalId,
  resource: ResourceId,
};
export const bases: Base[] = [
  { id: BaseId.Eurasia, name: "Eurasia", orbital: OrbitalId.Earth, resource: ResourceId.Food },
  { id: BaseId.Africa, name: "Africa", orbital: OrbitalId.Earth, resource: ResourceId.Water },
  { id: BaseId.MarinerValley, name: "Mariner Valley", orbital: OrbitalId.Mars, resource: ResourceId.Minerals },
  { id: BaseId.LondresNova, name: "Londres Nova", orbital: OrbitalId.Mars, resource: ResourceId.Tech },
  { id: BaseId.Ceres, name: "Ceres", orbital: OrbitalId.Ceres, resource: ResourceId.Minerals },
  { id: BaseId.Tycho, name: "Tycho", orbital: OrbitalId.Tycho, resource: ResourceId.Tech },
  { id: BaseId.Eros, name: "Eros", orbital: OrbitalId.Eros, resource: ResourceId.Minerals },
  { id: BaseId.Thoth, name: "Thoth", orbital: OrbitalId.Thoth, resource: ResourceId.Tech },
  { id: BaseId.Europa, name: "Europa", orbital: OrbitalId.Jupiter, resource: ResourceId.Water },
  { id: BaseId.Ganymede, name: "Ganymede", orbital: OrbitalId.Jupiter, resource: ResourceId.Food },
  { id: BaseId.Rhea, name: "Rhea", orbital: OrbitalId.Saturn, resource: ResourceId.Food },
  { id: BaseId.Titan, name: "Titan", orbital: OrbitalId.Saturn, resource: ResourceId.Water },
];

export enum PlayerId {
  MCR = 0,
  UN = 1,
};
export type Player = {
  id: PlayerId,
  name: string,
  opposite: PlayerId,
  homeOrbital: OrbitalId,
};
export const players: [Player, Player] = [
  { id: PlayerId.MCR, name: "MCR", opposite: PlayerId.UN, homeOrbital: OrbitalId.Mars },
  { id: PlayerId.UN, name: "UN", opposite: PlayerId.MCR, homeOrbital: OrbitalId.Earth },
];

export enum EventId {
  Drummer = 0,
  Miller = 1,
  Cotyar = 2,
  MaoKwik = 3,
  Assassin = 4,
  CovertOp = 5,
  BushNaval = 6,
  AntonyDresden = 7,
  FranklinDeGraff = 8,
  Terraforming = 9,
  VoicesEros = 10,
  DestructionDeimos = 11,
  BlockadeEarth = 12,
  BlockadeMars = 13,
  SadavirErrinwright = 14,
  Slingshot = 15,
  BlackOps = 16,
  JulieMao = 17,
  StarHelix = 18,
  RiotGear = 19,
  TheHybrid = 20,
  Nauvoo = 21,
  TheresaYao = 22,
  BobbieDraper = 23,
  Ambush = 24,
  CaptainYvgeny = 25,
  StealthShips = 26,
  HeavyBurn = 27,
  Razorback = 28,
  AdmiralSouther = 29,
};
export type Event = {
  id: EventId,
  title: string,
  subtitle: Optional<string>,
  text: string,
  ap: 2 | 3 | 4,
  keepCost: 0 | 1,
  factions: [boolean, boolean],
  modelImplemented: boolean,
};
export const events: Event[] = [
  {
    id: EventId.Drummer,
    title: "Inspiring Leadership",
    subtitle: opt("Camina Drummer"),
    text: "Perform 1 AP.",
    ap: 3,
    keepCost: 1,
    factions: [true, false],
    modelImplemented: true,
  },
  {
    id: EventId.Miller,
    title: "Unlikely Leads",
    subtitle: opt("Det. Josephus Miller"),
    text: "Keep this card at no CP cost. After using the AP of an action card, discard this to use the event as well, if eligible.",
    ap: 4,
    keepCost: 0,
    factions: [false, true],
    modelImplemented: true,
  },
  {
    id: EventId.Cotyar,
    title: "First-rate Spy",
    subtitle: opt("Agt. Cotyar Ghazi"),
    text: "Keep this card at no CP cost. Use to take 2 AP of actions. If you use this during scoring, peek at the bonus sector before your actions.",
    ap: 4,
    keepCost: 0,
    factions: [false, true],
    modelImplemented: true,
  },
  {
    id: EventId.MaoKwik,
    title: "Corporate Connections",
    subtitle: opt("Mao-Kwikowski Mercantile"),
    text: "Keep this card at no CP cost. Discard to treat the AP number on any Action Card as 4 AP.",
    ap: 3,
    keepCost: 0,
    factions: [true, true],
    modelImplemented: true,
  },
  {
    id: EventId.Assassin,
    title: "Bold Assassin",
    subtitle: opt("K. Nikil, Black Sky"),
    text: "Both players must discard one Kept card.",
    ap: 2,
    keepCost: 1,
    factions: [true, false],
    modelImplemented: true,
  },
  {
    id: EventId.CovertOp,
    title: "Covert Op",
    subtitle: opt("Operation Polyglottal Donkey"),
    text: "Exchange the position of two influence, one belonging to each player.",
    ap: 3,
    keepCost: 1,
    factions: [true, false],
    modelImplemented: true,
  },
  {
    id: EventId.BushNaval,
    title: "Military Industrial Complex",
    subtitle: opt("Bush Naval Shipyards"),
    text: "All players build all fleets. Gain 1 CP if your opponent built a fleet.",
    ap: 4,
    keepCost: 1,
    factions: [false, true],
    modelImplemented: true,
  },
  {
    id: EventId.AntonyDresden,
    title: "Unscrupulous Science Team",
    subtitle: opt("Antony Dresden, PhD"),
    text: "Place influence on each technology base: Londres Nova, Tycho, and Thoth.",
    ap: 4,
    keepCost: 1,
    factions: [false, true],
    modelImplemented: true,
  },
  {
    id: EventId.FranklinDeGraff,
    title: "Diplomatic Maneuvering",
    subtitle: opt("Amb. Franklin DeGraff"),
    text: "Place influence on each Earth base.",
    ap: 3,
    keepCost: 1,
    factions: [true, false],
    modelImplemented: true,
  },
  {
    id: EventId.Terraforming,
    title: "Terraforming",
    subtitle: nullopt,
    text: "Place influence in each Mars base.",
    ap: 2,
    keepCost: 1,
    factions: [true, false],
    modelImplemented: true,
  },
  {
    id: EventId.VoicesEros,
    title: "Lessons from History",
    subtitle: opt("The Voices of Eros"),
    text: "Place 1 influence in 1 Base each of the Inner Planets, Belt, and Outer Planets.",
    ap: 4,
    keepCost: 1,
    factions: [true, true],
    modelImplemented: true,
  },
  {
    id: EventId.DestructionDeimos,
    title: "Destruction of Deimos",
    subtitle: nullopt,
    text: "Must remove 1 influence from each Mars base. Place 1 influence on an Earth base.",
    ap: 4,
    keepCost: 1,
    factions: [false, true],
    modelImplemented: true,
  },
  {
    id: EventId.BlockadeEarth,
    title: "Blockade of Earth",
    subtitle: nullopt,
    text: "Place influence on an Earth base. If you have Orbital Control of Earth, you may also remove influence from an Earth base.",
    ap: 3,
    keepCost: 1,
    factions: [true, false],
    modelImplemented: true,
  },
  {
    id: EventId.BlockadeMars,
    title: "Blockade of Mars",
    subtitle: nullopt,
    text: "Place influence on a Mars base. If you have Orbital Control of Mars, you may also remove influence from a Mars base.",
    ap: 3,
    keepCost: 1,
    factions: [false, true],
    modelImplemented: true,
  },
  {
    id: EventId.SadavirErrinwright,
    title: "Executive Control",
    subtitle: opt("USG Sadavir Errinwright"),
    text: "On each Base where a player has 3 or more influence, they must remove 1.",
    ap: 4,
    keepCost: 1,
    factions: [false, true],
    modelImplemented: true,
  },
  {
    id: EventId.Slingshot,
    title: "Keplerian Noise",
    subtitle: opt("Slingshot Racing"),
    text: "Remove 1 influence from any Outer Planets Base.",
    ap: 2,
    keepCost: 1,
    factions: [true, false],
    modelImplemented: true,
  },
  {
    id: EventId.BlackOps,
    title: "Black Ops Team",
    subtitle: nullopt,
    text: "Remove 1 influence from up to 3 bases, each in a different Band.",
    ap: 4,
    keepCost: 1,
    factions: [true, true],
    modelImplemented: true,
  },
  {
    id: EventId.JulieMao,
    title: "Informed Insurgent",
    subtitle: opt("Op. Lionel Polanski"),
    text: "Remove 1 influence on 2 Bases with the same Resource type.",
    ap: 4,
    keepCost: 1,
    factions: [true, true],
    modelImplemented: true,
  },
  {
    id: EventId.StarHelix,
    title: "Security Contractors",
    subtitle: opt("Star Helix"),
    text: "Remove up to 2 influence total from Bases where you have influence.",
    ap: 3,
    keepCost: 1,
    factions: [true, true],
    modelImplemented: true,
  },
  {
    id: EventId.RiotGear,
    title: "Riots",
    subtitle: nullopt,
    text: "Remove up to 2 influence total on Belt Bases, no more than 1 per Base.",
    ap: 3,
    keepCost: 1,
    factions: [true, false],
    modelImplemented: true,
  },
  {
    id: EventId.TheHybrid,
    title: "Bio-weapon",
    subtitle: opt("The Hybrid"),
    text: "Select a Base. Draw the top card from the deck. Remove influence equal to the AP. If a Score card, remove all influence. Put card back on top of deck.",
    ap: 4,
    keepCost: 1,
    factions: [true, true],
    modelImplemented: true,
  },
  {
    id: EventId.Nauvoo,
    title: "Cultural Break",
    subtitle: opt("I.S. Nauvoo"),
    text: "Remove 1 influence or 1 fleet from anywhere.",
    ap: 2,
    keepCost: 1,
    factions: [true, true],
    modelImplemented: true,
  },
  {
    id: EventId.TheresaYao,
    title: "Experienced Captain",
    subtitle: opt("Cpt. Theresa Yao"),
    text: "Remove X of your fleets from an Orbital. Remove X+1 opponent fleets (total) from that Orbital. X may be zero.",
    ap: 3,
    keepCost: 1,
    factions: [true, false],
    modelImplemented: true,
  },
  {
    id: EventId.BobbieDraper,
    title: "Boarding Party",
    subtitle: opt("GySgt. Bobbie Draper"),
    text: "Remove one opposing fleet, and place one of your fleets in the same Orbital (either unbuilt, or from another Orbital).",
    ap: 4,
    keepCost: 1,
    factions: [true, true],
    modelImplemented: true,
  },
  {
    id: EventId.Ambush,
    title: "Ambush",
    subtitle: nullopt,
    text: "Remove zero or one of each player's fleets from the same Orbital.",
    ap: 3,
    keepCost: 1,
    factions: [true, false],
    modelImplemented: true,
  },
  {
    id: EventId.CaptainYvgeny,
    title: "Reliable Captain",
    subtitle: opt("Cpt. C. Yvgeny"),
    text: "Remove 1 opponent fleet from an Orbital where you have a fleet.",
    ap: 2,
    keepCost: 1,
    factions: [false, true],
    modelImplemented: true,
  },
  {
    id: EventId.StealthShips,
    title: "Stealth Ships",
    subtitle: nullopt,
    text: "Move a fleet up to 1 band, then remove it to remove up to 2 opposing fleets in the same Orbital.",
    ap: 3,
    keepCost: 1,
    factions: [false, true],
    modelImplemented: true,
  },
  {
    id: EventId.HeavyBurn,
    title: "Heavy Burn",
    subtitle: nullopt,
    text: "Move up to two fleet groups up to two Bands each.",
    ap: 3,
    keepCost: 1,
    factions: [true, true],
    modelImplemented: true,
  },
  {
    id: EventId.Razorback,
    title: "Optimized Design",
    subtitle: opt("Razorback"),
    text: "Move 1 fleet to any Orbital.",
    ap: 2,
    keepCost: 1,
    factions: [false, true],
    modelImplemented: true,
  },
  {
    id: EventId.AdmiralSouther,
    title: "Command Initiative",
    subtitle: opt("Adm. Michael Souther"),
    text: "You may move each of your fleets up to one band.",
    ap: 4,
    keepCost: 1,
    factions: [true, true],
    modelImplemented: true,
  },
];

export enum CardType { Event, Score };
export type Card =
  | { type: CardType.Event, event: EventId }
  | { type: CardType.Score };

export const TRACK_COUNT = 5;
export const trackCost: number[] = [0, 1, 1, 2, 2];
export const SCORES_PER_PILE = 2;
export const NONSCORES_PER_PILE = 8;
export const PILES = 3;
export const FLEET_COUNT = 5;

export type GameStateBoard = {
  cp: [number, number],
  fleets: [number, number][/*orbital*/],
  influence: [number, number][/*base*/],
  cardTrack: Card[],
  deck: Card[],
  kept: [EventId[], EventId[]],
  bonusSectorsRemaining: [number, number, number],
};

export const bonusSectorBonusPoints: [number, number][] = [
  [1, 1],
  [2, 1],
  [2, 1],
  [3, 2],
  [3, 2],
];

export type GameStateAPPhase = { ap: number, selectedFleetGroup: Optional<{ orbital: OrbitalId, count: number }> }

export type EventIdKeepOnly =
  | EventId.Miller
  | EventId.MaoKwik;
export type EventIdDeterministic =
  | EventId.BushNaval
  | EventId.AntonyDresden
  | EventId.FranklinDeGraff
  | EventId.Terraforming
  | EventId.SadavirErrinwright;
export type GameStateEventPhase =
  | ({ focus: EventId.Drummer } & GameStateAPPhase)
  // miller takes place during initiative
  | ({ focus: EventId.Cotyar } & GameStateAPPhase)
  // mao-kwik takes place before ap
  | { focus: EventId.Assassin, assassinAction: PlayerId }
  | { focus: EventId.CovertOp, selectedInfluence: Optional<{ base: BaseId, player: PlayerId }> }
  // bush naval yards is deterministic
  // antony dresden is deterministic
  // franklin degraff is deterministic
  // terraforming is deterministic
  | { focus: EventId.VoicesEros, placingSector: SectorId }
  | { focus: EventId.DestructionDeimos }
  | { focus: EventId.BlockadeEarth, placing: boolean }
  | { focus: EventId.BlockadeMars, placing: boolean }
  // sadavir errinwright is deterministic
  | { focus: EventId.Slingshot }
  | { focus: EventId.BlackOps, remaining: number, bandPermitted: boolean[/*band*/] }
  | { focus: EventId.JulieMao, removedBase: Optional<BaseId> }
  | { focus: EventId.StarHelix, remaining: number }
  | { focus: EventId.RiotGear, removedBase: Optional<BaseId> }
  | { focus: EventId.TheHybrid, selected: Optional<{ base: BaseId, topEvent: EventId }> }
  | { focus: EventId.Nauvoo }
  | { focus: EventId.TheresaYao }
  | { focus: EventId.BobbieDraper, removedOrbital: Optional<OrbitalId> }
  | { focus: EventId.Ambush, removed: Optional<{ orbital: OrbitalId, player: PlayerId }> }
  | { focus: EventId.CaptainYvgeny }
  | { focus: EventId.StealthShips, selectedFleet: Optional<OrbitalId> }
  | { focus: EventId.HeavyBurn, remaining: number, fleetsPermitted: number[], selectedFleetGroup: Optional<{ orbital: OrbitalId, count: number }> }
  | { focus: EventId.Razorback, selectedFleet: Optional<OrbitalId> }
  | { focus: EventId.AdmiralSouther, remaining: number, fleetsPermitted: number[], selectedFleetGroup: Optional<{ orbital: OrbitalId, count: number }> }
  ;

export type GameStatePhaseEventPhase =
  | ({ phase: "ap turn initiative event", turn: PlayerId })
  | ({ phase: "event turn event", turn: PlayerId })
  | ({ phase: "score turn kept event", turn: PlayerId, bonusSector: SectorId, action: PlayerId })
  ;
export type GameStatePhase =
  | (GameStatePhaseEventPhase & GameStateEventPhase)
  | { phase: "start", turn: PlayerId, focus: Optional<EventId> }
  | { phase: "ap turn deciding mao-kwik", turn: PlayerId, focus: EventId }
  | ({ phase: "ap turn ap", turn: PlayerId, focus: EventId } & GameStateAPPhase)
  | { phase: "ap turn deciding miller", turn: PlayerId, focus: EventId }
  | { phase: "ap turn initiative deciding", turn: PlayerId, focus: EventId }
  // ap turn initiative event
  // event turn event
  | { phase: "score turn deciding sector", turn: PlayerId }
  | { phase: "score turn kept event deciding", turn: PlayerId, bonusSector: SectorId, action: PlayerId }
  // score turn kept event
  | { phase: "game over" }
  ;

export type GameState = {
  board: GameStateBoard,
  phase: GameStatePhase,
};
