import { Optional } from "../core/optional";
import { BaseId, Card, EventId, OrbitalId, PlayerId, SectorId } from "./parameters";




export type GameStateBoard = {
  cp: [number, number],
  fleets: [number, number][/*orbital*/],
  influence: [number, number][/*base*/],
  cardTrack: Card[],
  deck: Card[],
  kept: [EventId[], EventId[]],
  bonusSectorsRemaining: [number, number, number],
};


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
