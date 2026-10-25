import * as ort from 'onnxruntime-web';
import { BaseId, bases, CardType, EventId, events, orbitals, players, sectors, TRACK_COUNT } from './parameters';
import { GameState, GameStateContinuation, GameStateContinuations, getContinuations } from './state';
import { assertType, asType, satisfiesCheck } from '../core/misc';
import { nullopt, opt, Optional, optMap, optValueOr, throwOnNullopt } from '../core/optional';

export type ModelInput = {
  obsBool: boolean[],
  obsInt: number[],
  obsSlotIndex: number[],
  obsPilePresent: boolean[][],
};

const PLAYER_COUNT = 2;
if (PLAYER_COUNT != players.length) throw `assert PLAYER_COUNT`;
const SECTOR_COUNT = 3;
if (SECTOR_COUNT != sectors.length) throw `assert SECTOR_COUNT`;
const ORBITAL_COUNT = 8;
if (ORBITAL_COUNT != orbitals.length) throw `assert ORBITAL_COUNT`;
const BASE_COUNT = 12;
if (BASE_COUNT != bases.length) throw `assert BASE_COUNT`;
const EVENT_COUNT = 30;
if (EVENT_COUNT != events.length) throw `assert CARD_COUNT`;

enum OBS_BOOL {
  PHASE_START = 0,
  PHASE_TURN_TYPE_START = PHASE_START + 1,
  PHASE_AP_TURN = PHASE_TURN_TYPE_START,
  PHASE_EVENT_TURN = PHASE_AP_TURN + 1,
  PHASE_SCORE_TURN = PHASE_EVENT_TURN + 1,
  PHASE_TURN_TYPE_END = PHASE_SCORE_TURN + 1,
  PHASE_CHOOSE_MAO_KWIK = PHASE_TURN_TYPE_END,
  PHASE_ACTION = PHASE_CHOOSE_MAO_KWIK + 1,
  PHASE_ACTION_DONE = PHASE_ACTION + 1,
  PHASE_EVENT = PHASE_ACTION_DONE + 1,
  PHASE_EVENT_DONE = PHASE_EVENT + 1,
  PHASE_CHOOSE_SECTOR = PHASE_EVENT_DONE + 1,
  PHASE_CHOOSE_EVENT = PHASE_CHOOSE_SECTOR + 1,
  PHASE_DONE = PHASE_CHOOSE_EVENT + 1,
  PHASE_ARG_BASE = PHASE_DONE + 1,
  PLAYER_TURN = PHASE_ARG_BASE + BASE_COUNT,
  PLAYER_EVENT = PLAYER_TURN + PLAYER_COUNT,
  PLAYER_ACTION = PLAYER_EVENT + PLAYER_COUNT,
  PLAYER_PERSPECTIVE = PLAYER_ACTION + PLAYER_COUNT,
  SCORE_SECTOR = PLAYER_PERSPECTIVE + PLAYER_COUNT,
  SCORE_SECTOR_REVEALED_TO_ALL = SCORE_SECTOR + SECTOR_COUNT,
  LENGTH = SCORE_SECTOR_REVEALED_TO_ALL + 1,
};

enum OBS_INT {
  PHASE_AP = 0,
  PHASE_EVENT_ACTIONS = PHASE_AP + 1,
  PHASE_EVENT_ELIGIBLE_FLEETS = PHASE_EVENT_ACTIONS + 1,
  CP = PHASE_EVENT_ELIGIBLE_FLEETS + ORBITAL_COUNT,
  FLEETS = CP + PLAYER_COUNT,
  INFLUENCE = FLEETS + (ORBITAL_COUNT * PLAYER_COUNT),
  DECK_PILE_SCORES = INFLUENCE + (BASE_COUNT * PLAYER_COUNT),
  DECK_PILE_NONSCORES = DECK_PILE_SCORES + 1,
  DECK_PILES = DECK_PILE_NONSCORES + 1,
  BONUS_SECTORS = DECK_PILES + 1,
  LENGTH = BONUS_SECTORS + SECTOR_COUNT,
};

enum OBS_SLOT_INDEX {
  FOCUS = 0,
  REVEALED_DECK_TOP = FOCUS + 1,
  TRACK = REVEALED_DECK_TOP + 1,
  COUNT = TRACK + TRACK_COUNT,
};

enum OBS_PILE_PRESENT {
  DECK = 0,
  KEPT = DECK + 1,
  COUNT = KEPT + PLAYER_COUNT,
};

enum EXTRA_CARD {
  SCORE = EVENT_COUNT,
  EMPTY_TRACK = SCORE + 1,
  EMPTY_FOCUS = EMPTY_TRACK + 1,
  EMPTY_REVEALED_DECK_TOP = EMPTY_FOCUS + 1,
  COUNT = EMPTY_REVEALED_DECK_TOP - SCORE + 1,
};

const STARTING_DECK_PILE_COUNT = 3
const SCORES_PER_PILE = 2
const NONSCORES_PER_PILE = 8
const NONSCORES_NOT_IN_A_PILE = EVENT_COUNT - TRACK_COUNT - (STARTING_DECK_PILE_COUNT * NONSCORES_PER_PILE)

export function stateToInput(previousState: Optional<GameState>, state: GameState): Optional<ModelInput> {
  const obsBool: boolean[] = Array(OBS_BOOL.LENGTH).fill(false);
  const obsInt: number[] = Array(OBS_INT.LENGTH).fill(0);
  const obsSlotIndex: number[] = Array(OBS_SLOT_INDEX.COUNT).fill(0);
  const obsPilePresent: boolean[][] = Array(OBS_PILE_PRESENT.COUNT).map(_pile => Array(EVENT_COUNT + EXTRA_CARD.COUNT).fill(false));

  obsInt.splice(OBS_INT.CP, PLAYER_COUNT, ...state.board.cp);
  obsInt.splice(OBS_INT.FLEETS, ORBITAL_COUNT * PLAYER_COUNT, ...state.board.fleets.flat());
  obsInt.splice(OBS_INT.INFLUENCE, BASE_COUNT * PLAYER_COUNT, ...state.board.influence.flat());
  const pileSliceLen = ((state.board.deck.length - NONSCORES_NOT_IN_A_PILE + (SCORES_PER_PILE + NONSCORES_PER_PILE - 1)) % (SCORES_PER_PILE + NONSCORES_PER_PILE)) + 1
  obsInt.splice(OBS_INT.DECK_PILE_SCORES, 1, state.board.deck.slice(-pileSliceLen).filter(c => c.type === CardType.Score).length);
  obsInt.splice(OBS_INT.DECK_PILE_NONSCORES, 1, state.board.deck.slice(-pileSliceLen).filter(c => c.type === CardType.Event).length);
  obsInt.splice(OBS_INT.DECK_PILES, 1, Math.floor((state.board.deck.length - pileSliceLen) / (SCORES_PER_PILE + NONSCORES_PER_PILE)));
  obsInt.splice(OBS_INT.BONUS_SECTORS, SECTOR_COUNT, ...state.board.bonusSectorsRemaining);

  obsSlotIndex.splice(OBS_SLOT_INDEX.FOCUS, 1, EXTRA_CARD.EMPTY_FOCUS);
  obsSlotIndex.splice(OBS_SLOT_INDEX.REVEALED_DECK_TOP, 1, EXTRA_CARD.EMPTY_REVEALED_DECK_TOP);
  obsSlotIndex.splice(OBS_SLOT_INDEX.TRACK, TRACK_COUNT, ...Array(TRACK_COUNT).fill(false).map((_, iTrack) => {
    const card = state.board.cardTrack.get(iTrack);
    if (card.hasValue === false) return EXTRA_CARD.EMPTY_TRACK;
    else if (card.value.type === CardType.Score) return EXTRA_CARD.SCORE;
    else return card.value.event;
  }));

  obsPilePresent.splice(OBS_PILE_PRESENT.DECK, 1, state.board.deck.reduce(
    (present, card) => card.type === CardType.Score
      ? present
      : present.with(card.event, true),
    asType<boolean[]>()(Array(EVENT_COUNT).fill(false))));
  obsPilePresent.splice(OBS_PILE_PRESENT.KEPT, PLAYER_COUNT, ...state.board.kept.map(kept => kept.reduce(
    (present, card) => present.with(card, true),
    asType<boolean[]>()(Array(EVENT_COUNT).fill(false)))));


  if (
    state.phase.phase === "game over"
    || state.phase.phase === "start"
  ) {
    if (
      previousState.hasValue
      && (
        state.phase.phase === "game over"
        || previousState.value.board.cardTrack.length != TRACK_COUNT
      )
    ) { // just did end-of-turn draw -- mask the drawn card (stochastic)
      if (previousState.value.phase.phase === "game over") throw `state after game over state`;
      obsBool.splice(OBS_BOOL.PHASE_DONE, 1, true);
      obsBool.splice(OBS_BOOL.PLAYER_TURN + previousState.value.phase.turn, 1, true);

      const pileSliceLen = ((previousState.value.board.deck.length - NONSCORES_NOT_IN_A_PILE + (SCORES_PER_PILE + NONSCORES_PER_PILE - 1)) % (SCORES_PER_PILE + NONSCORES_PER_PILE)) + 1
      obsInt.splice(OBS_INT.DECK_PILE_SCORES, 1, previousState.value.board.deck.slice(-pileSliceLen).filter(c => c.type === CardType.Score).length);
      obsInt.splice(OBS_INT.DECK_PILE_NONSCORES, 1, previousState.value.board.deck.slice(-pileSliceLen).filter(c => c.type === CardType.Event).length);
      obsInt.splice(OBS_INT.DECK_PILES, 1, Math.floor((previousState.value.board.deck.length - pileSliceLen) / (SCORES_PER_PILE + NONSCORES_PER_PILE)));

      obsSlotIndex.splice(OBS_SLOT_INDEX.TRACK, TRACK_COUNT, ...Array(TRACK_COUNT).fill(false).map((_, iTrack) => {
        const card = previousState.value.board.cardTrack.get(iTrack);
        if (card.hasValue === false) return EXTRA_CARD.EMPTY_TRACK;
        else if (card.value.type === CardType.Score) return EXTRA_CARD.SCORE;
        else return card.value.event;
      }));

      obsPilePresent.splice(OBS_PILE_PRESENT.DECK, 1, previousState.value.board.deck.reduce(
        (present, card) => card.type === CardType.Score
          ? present
          : present.with(card.event, true),
        asType<boolean[]>()(Array(EVENT_COUNT).fill(false))));
    }
    else if (state.phase.phase === "game over") {
      throw `starting state game over`;
    }
    else {
      obsBool.splice(OBS_BOOL.PHASE_START, 1, true);
      obsBool.splice(OBS_BOOL.PLAYER_TURN + state.phase.turn, 1, true);
      obsBool.splice(OBS_BOOL.PLAYER_ACTION + state.phase.turn, 1, true);
      obsBool.splice(OBS_BOOL.PLAYER_PERSPECTIVE + state.phase.turn, 1, true);
    }
  }
  else if (
    previousState.hasValue
    && (
      previousState.value.phase.phase === "ap turn initiative event"
      || previousState.value.phase.phase === "event turn event"
      || previousState.value.phase.phase === "score turn kept event"
    )
    && previousState.value.phase.focus === EventId.TheHybrid
    && previousState.value.phase.selected.hasValue === false
  ) { // just did hybrid draw -- mask the drawn card (stochastic)
    const eventPlayer =
      previousState.value.phase.phase === "ap turn initiative event"
        ? players[previousState.value.phase.turn].opposite
        : previousState.value.phase.phase === "event turn event"
          ? previousState.value.phase.turn
          : satisfiesCheck<"score turn kept event">(previousState.value.phase.phase)(previousState.value.phase.action);
    obsBool.splice(OBS_BOOL.PHASE_EVENT, 1, true);
    obsBool.splice(OBS_BOOL.PLAYER_TURN + previousState.value.phase.turn, 1, true);
    obsBool.splice(OBS_BOOL.PLAYER_EVENT + eventPlayer, 1, true);
    obsBool.splice(OBS_BOOL.PHASE_ACTION + eventPlayer, 1, true);
    obsBool.splice(OBS_BOOL.PLAYER_PERSPECTIVE + eventPlayer, 1, true);

    obsSlotIndex.splice(OBS_SLOT_INDEX.FOCUS, 1, previousState.value.phase.focus);

    if (previousState.value.phase.phase === "ap turn initiative event") {
      obsBool.splice(OBS_BOOL.PHASE_AP_TURN, 1, true);
    }
    else if (previousState.value.phase.phase === "event turn event") {
      obsBool.splice(OBS_BOOL.PHASE_EVENT_TURN, 1, true);
    }
    else {
      satisfiesCheck<"score turn kept event">(previousState.value.phase.phase);

      obsBool.splice(OBS_BOOL.SCORE_SECTOR + previousState.value.phase.bonusSector, 1, true);
      const allRevealed = optValueOr(optMap(previousState.value.phase.history.events[players[previousState.value.phase.turn].opposite], e => e === EventId.Cotyar), false);
      obsBool.splice(OBS_BOOL.SCORE_SECTOR_REVEALED_TO_ALL, 1, allRevealed);

      if (
        eventPlayer == state.phase.turn
        || allRevealed
      ) {
        obsInt.splice(OBS_INT.BONUS_SECTORS + previousState.value.phase.bonusSector, 1, previousState.value.board.bonusSectorsRemaining[previousState.value.phase.bonusSector] - 1);
      } else {
        obsBool.splice(OBS_BOOL.SCORE_SECTOR + previousState.value.phase.bonusSector, 1, false);
      }
    }

    const selectedBase: BaseId =
      (
        state.phase.phase === previousState.value.phase.phase
        && state.phase.focus === EventId.TheHybrid
        && state.phase.selected.hasValue
      )
        ? state.phase.selected.value.base
        : optValueOr(
          previousState.value.board.influence.takeZip(state.board.influence)
            .filterTransform(([previousBInfluence, bInfluence], iBase) =>
              previousBInfluence.reduce((a, b) => a + b) > bInfluence.reduce((a, b) => a + b)
                ? opt(iBase)
                : nullopt
            ).get(0),
          throwOnNullopt(
            // this gets used if no base lost influence, meaning the selected base must've been empty
            previousState.value.board.influence.filterTransform((bInfluence, iBase) => bInfluence.every(i => i == 0) ? opt(iBase) : nullopt).get(0),
            // this should never get used
            "all bases had influence but none lost influence to hybrid"
          )
        );
    obsBool.splice(OBS_BOOL.PHASE_ARG_BASE + selectedBase, 1, true);

    obsInt.splice(OBS_INT.INFLUENCE, BASE_COUNT * PLAYER_COUNT, ...previousState.value.board.influence.flat());
  }
  else if (state.phase.phase === "ap turn deciding mao-kwik") {
    obsBool.splice(OBS_BOOL.PHASE_AP_TURN, 1, true);
    obsBool.splice(OBS_BOOL.PHASE_CHOOSE_MAO_KWIK, 1, true);
    obsBool.splice(OBS_BOOL.PLAYER_TURN + state.phase.turn, 1, true);
    obsBool.splice(OBS_BOOL.PLAYER_ACTION + state.phase.turn, 1, true);
    obsBool.splice(OBS_BOOL.PLAYER_PERSPECTIVE + state.phase.turn, 1, true);

    obsSlotIndex.splice(OBS_SLOT_INDEX.FOCUS, 1, state.phase.focus);
  }
  else if (state.phase.phase === "ap turn ap") {
    if (state.phase.selectedFleetGroup.hasValue) return nullopt;

    obsBool.splice(OBS_BOOL.PHASE_AP_TURN, 1, true);
    obsBool.splice(OBS_BOOL.PHASE_ACTION, 1, true);
    obsBool.splice(OBS_BOOL.PLAYER_TURN + state.phase.turn, 1, true);
    obsBool.splice(OBS_BOOL.PLAYER_ACTION + state.phase.turn, 1, true);
    obsBool.splice(OBS_BOOL.PLAYER_PERSPECTIVE + state.phase.turn, 1, true);

    obsInt.splice(OBS_INT.PHASE_AP, 1, state.phase.ap);

    obsSlotIndex.splice(OBS_SLOT_INDEX.FOCUS, 1, state.phase.focus);
  }
  else if (state.phase.phase === "ap turn deciding miller") {
    obsBool.splice(OBS_BOOL.PHASE_AP_TURN, 1, true);
    obsBool.splice(OBS_BOOL.PHASE_ACTION_DONE, 1, true);
    obsBool.splice(OBS_BOOL.PLAYER_TURN + state.phase.turn, 1, true);
    obsBool.splice(OBS_BOOL.PLAYER_ACTION + state.phase.turn, 1, true);
    obsBool.splice(OBS_BOOL.PLAYER_PERSPECTIVE + state.phase.turn, 1, true);

    obsSlotIndex.splice(OBS_SLOT_INDEX.FOCUS, 1, state.phase.focus);
  }
  else if (state.phase.phase === "ap turn initiative deciding") {
    obsBool.splice(OBS_BOOL.PHASE_AP_TURN, 1, true);
    obsBool.splice(OBS_BOOL.PHASE_CHOOSE_EVENT, 1, true);
    obsBool.splice(OBS_BOOL.PLAYER_TURN + state.phase.turn, 1, true);
    obsBool.splice(OBS_BOOL.PLAYER_ACTION + players[state.phase.turn].opposite, 1, true);
    obsBool.splice(OBS_BOOL.PLAYER_PERSPECTIVE + players[state.phase.turn].opposite, 1, true);

    obsSlotIndex.splice(OBS_SLOT_INDEX.FOCUS, 1, state.phase.focus);
  }
  else if (state.phase.phase === "score turn deciding sector") {
    obsBool.splice(OBS_BOOL.PHASE_SCORE_TURN, 1, true);
    obsBool.splice(OBS_BOOL.PHASE_CHOOSE_SECTOR, 1, true);
    obsBool.splice(OBS_BOOL.PLAYER_TURN + state.phase.turn, 1, true);
    obsBool.splice(OBS_BOOL.PLAYER_ACTION + state.phase.turn, 1, true);
    obsBool.splice(OBS_BOOL.PLAYER_PERSPECTIVE + state.phase.turn, 1, true);
  }
  else if (state.phase.phase === "score turn kept event deciding") {
    if (previousState.hasValue === false) throw `starting state score turn kept event deciding`;
    if (previousState.value.phase.phase === "game over") throw `state after game over`;

    obsBool.splice(OBS_BOOL.PHASE_SCORE_TURN, 1, true);
    obsBool.splice(OBS_BOOL.PHASE_CHOOSE_EVENT, 1, true);
    obsBool.splice(OBS_BOOL.PLAYER_TURN + state.phase.turn, 1, true);
    obsBool.splice(OBS_BOOL.PLAYER_ACTION + state.phase.action, 1, true);
    const perspective =
      previousState.value.phase.phase === "score turn deciding sector"
        ? state.phase.turn
        : previousState.value.phase.phase === "score turn kept event deciding"
          ? previousState.value.phase.action
          : previousState.value.phase.phase !== "score turn kept event"
            ? (() => { throw `bad score phase sequence`; })()
            : previousState.value.phase.focus === EventId.Assassin
              ? previousState.value.phase.assassinAction
              : previousState.value.phase.action;
    obsBool.splice(OBS_BOOL.PLAYER_PERSPECTIVE + perspective, 1, true);

    obsBool.splice(OBS_BOOL.SCORE_SECTOR + state.phase.bonusSector, 1, true);
    const allRevealed = optValueOr(optMap(state.phase.history.events[players[state.phase.turn].opposite], e => e === EventId.Cotyar), false);
    obsBool.splice(OBS_BOOL.SCORE_SECTOR_REVEALED_TO_ALL, 1, allRevealed);

    if (
      perspective == state.phase.turn
      || allRevealed
    ) {
      obsInt.splice(OBS_INT.BONUS_SECTORS + state.phase.bonusSector, 1, state.board.bonusSectorsRemaining[state.phase.bonusSector] - 1);
    } else {
      obsBool.splice(OBS_BOOL.SCORE_SECTOR + state.phase.bonusSector, 1, false);
    }
  }
  else {
    assertType<
      | "ap turn initiative event"
      | "event turn event"
      | "score turn kept event"
    >(state.phase.phase);

    const eventPlayer =
      state.phase.phase === "ap turn initiative event"
        ? players[state.phase.turn].opposite
        : state.phase.phase === "event turn event"
          ? state.phase.turn
          : satisfiesCheck<"score turn kept event">(state.phase.phase)(state.phase.action);
    obsBool.splice(OBS_BOOL.PHASE_EVENT, 1, true);
    obsBool.splice(OBS_BOOL.PLAYER_TURN + state.phase.turn, 1, true);
    obsBool.splice(OBS_BOOL.PLAYER_EVENT + eventPlayer, 1, true);

    const actionPlayer =
      state.phase.focus === EventId.Assassin
        ? state.phase.assassinAction
        : eventPlayer;
    obsBool.splice(OBS_BOOL.PHASE_ACTION + actionPlayer, 1, true);
    obsBool.splice(OBS_BOOL.PLAYER_PERSPECTIVE + actionPlayer, 1, true);

    obsSlotIndex.splice(OBS_SLOT_INDEX.FOCUS, 1, state.phase.focus);

    if (state.phase.phase === "ap turn initiative event") {
      obsBool.splice(OBS_BOOL.PHASE_AP_TURN, 1, true);
    }
    else if (state.phase.phase === "event turn event") {
      obsBool.splice(OBS_BOOL.PHASE_EVENT_TURN, 1, true);
    }
    else {
      satisfiesCheck<"score turn kept event">(state.phase.phase);

      if (previousState.hasValue === false) throw `starting state score turn kept event deciding`;
      if (previousState.value.phase.phase === "game over") throw `state after game over`;

      const perspective =
        previousState.value.phase.phase === "score turn kept event deciding"
          ? previousState.value.phase.action
          : previousState.value.phase.phase !== "score turn kept event"
            ? (() => { throw `bad score phase sequence`; })()
            : previousState.value.phase.focus === EventId.Assassin
              ? previousState.value.phase.assassinAction
              : previousState.value.phase.action;
      obsBool.splice(OBS_BOOL.PLAYER_PERSPECTIVE + actionPlayer, 1, false);
      obsBool.splice(OBS_BOOL.PLAYER_PERSPECTIVE + perspective, 1, true);

      obsBool.splice(OBS_BOOL.SCORE_SECTOR + state.phase.bonusSector, 1, true);
      const allRevealed = (
        optValueOr(optMap(state.phase.history.events[players[state.phase.turn].opposite], e => e === EventId.Cotyar), false)
        || (
          eventPlayer === players[state.phase.turn].opposite
          && state.phase.focus === EventId.Cotyar
        )
      );
      obsBool.splice(OBS_BOOL.SCORE_SECTOR_REVEALED_TO_ALL, 1, allRevealed);

      if (
        perspective == state.phase.turn
        || allRevealed
      ) {
        obsInt.splice(OBS_INT.BONUS_SECTORS + state.phase.bonusSector, 1, state.board.bonusSectorsRemaining[state.phase.bonusSector] - 1);
      } else {
        obsBool.splice(OBS_BOOL.SCORE_SECTOR + state.phase.bonusSector, 1, false);
      }
    }

    if (
      state.phase.focus === EventId.Drummer
      || state.phase.focus === EventId.Cotyar
    ) {
      if (state.phase.selectedFleetGroup.hasValue) return nullopt;

      obsBool.splice(OBS_BOOL.PHASE_ACTION, 1, true);

      obsInt.splice(OBS_INT.PHASE_AP, 1, state.phase.ap);
    }
    else if (state.phase.focus === EventId.CovertOp) {
      if (state.phase.selectedInfluence.hasValue) return nullopt;
    }
    else if (state.phase.focus === EventId.VoicesEros) {
      if (state.phase.placingSector > 0) return nullopt;
    }
    else if (
      state.phase.focus === EventId.BlockadeEarth
      || state.phase.focus === EventId.BlockadeMars
    ) {
      if (state.phase.placing === false) return nullopt;
    }
    else if (state.phase.focus === EventId.BlackOps) {
      if (state.phase.remaining < 3) return nullopt;
    }
    else if (state.phase.focus === EventId.JulieMao) {
      if (state.phase.removedBase.hasValue) return nullopt;
    }
    else if (state.phase.focus === EventId.StarHelix) {
      if (state.phase.remaining < 2) return nullopt;
    }
    else if (state.phase.focus === EventId.RiotGear) {
      if (state.phase.removedBase.hasValue) return nullopt;
    }
    else if (state.phase.focus === EventId.TheHybrid) {
      if (state.phase.selected.hasValue) throw `hybrid mao-kwik should've been handled above`;
    }
    else if (state.phase.focus === EventId.BobbieDraper) {
      if (state.phase.removedOrbital.hasValue) return nullopt;
    }
    else if (state.phase.focus === EventId.Ambush) {
      if (state.phase.removed.hasValue) return nullopt;
    }
    else if (state.phase.focus === EventId.StealthShips) {
      if (state.phase.selectedFleet.hasValue) return nullopt;
    }
    else if (
      state.phase.focus === EventId.HeavyBurn
      || state.phase.focus === EventId.AdmiralSouther
    ) {
      if (state.phase.selectedFleetGroup.hasValue) return nullopt;

      obsInt.splice(OBS_INT.PHASE_EVENT_ACTIONS, 1, state.phase.remaining);
      obsInt.splice(OBS_INT.PHASE_EVENT_ELIGIBLE_FLEETS, ORBITAL_COUNT, ...state.phase.fleetsPermitted);
    }
    else if (state.phase.focus === EventId.Razorback) {
      if (state.phase.selectedFleet.hasValue) return nullopt;
    }
    else if (
      state.phase.focus === EventId.Assassin
      || state.phase.focus === EventId.DestructionDeimos
      || state.phase.focus === EventId.Slingshot
      || state.phase.focus === EventId.Nauvoo
      || state.phase.focus === EventId.TheresaYao
      || state.phase.focus === EventId.CaptainYvgeny
    ) { }
    else assertType<never>(state.phase);
  }

  return opt({ obsBool, obsInt, obsSlotIndex, obsPilePresent });
}

export function getStateContinuationsInputs(state: GameState): {
  rootContinuations: GameStateContinuations,
  choices: {
    trace: {
      choice: GameStateContinuation,
      continuations: GameStateContinuations,
    }[],
    final: Optional<{
      choice: GameStateContinuation,
      input: ModelInput,
    }>,
  }[],
} {
  const rootContinuations = getContinuations(state);
  const rootDecision = rootContinuations.decision
  if (rootDecision.hasValue === false) return {
    rootContinuations,
    choices: [],
  }

  return {
    rootContinuations,
    choices:
      [
        ...rootDecision.value.actions.clickBase,
        ...rootDecision.value.actions.clickBuildFleet,
        ...rootDecision.value.actions.clickFleet.map(x => x.flat()).flat(),
        ...rootDecision.value.actions.clickInfluence.map(x => x.flat()).flat(),
        rootDecision.value.actions.clickKeepEvent,
        ...rootDecision.value.actions.clickKeptCard.flat(),
        ...rootDecision.value.actions.clickOrbital,
        rootDecision.value.actions.clickPass,
        ...rootDecision.value.actions.clickSector,
        ...rootDecision.value.actions.clickTrackCard,
        rootDecision.value.actions.clickUseAP,
        rootDecision.value.actions.clickUseEvent,
      ]
        .filterTransform(continuation => continuation)
        .flatMap(choice => {
          const input = stateToInput(opt(state), choice.state);
          if (input.hasValue) {
            return [{
              trace: [],
              final: opt({
                choice,
                input: input.value,
              }),
            }];
          }

          const choiceStateContinuationsInputs = getStateContinuationsInputs(choice.state);
          if (
            choiceStateContinuationsInputs.rootContinuations.decision.hasValue === false
            || choiceStateContinuationsInputs.rootContinuations.decision.value.player != rootDecision.value.player
          ) {
            return [{
              trace: [],
              final: nullopt,
            }];
          }

          return choiceStateContinuationsInputs.choices.map(followupChoice => ({
            trace: [
              {
                choice,
                continuations: choiceStateContinuationsInputs.rootContinuations,
              }
            ].concat(followupChoice.trace),
            final: followupChoice.final,
          }));
        }),
  };
}

function normalCDF(x: number, mean: number, stdDev: number): number {
  const z = (x - mean) / stdDev;

  const p = 0.2315419;
  const b1 = 0.319381530;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;

  const absZ = Math.abs(z);
  const t = 1.0 / (1.0 + p * absZ);

  const pdf = (1.0 / Math.sqrt(2.0 * Math.PI)) * Math.exp(-0.5 * absZ * absZ);

  const prob = 1.0 - pdf * (b1 * t + b2 * Math.pow(t, 2) + b3 * Math.pow(t, 3) + b4 * Math.pow(t, 4) + b5 * Math.pow(t, 5));

  return (
    z < 0
      ? 1.0 - prob
      : prob
  );
}

export class ExpanseModel_Sirius {

  private session: ort.InferenceSession;

  private constructor(session: ort.InferenceSession) {
    this.session = session;
  }

  public static weightsPath = "assets/model/1_sirius_2_weights___179424_5901998.onnx";
  // can't use public release, shame: https://github.com/orgs/community/discussions/106849#discussioncomment-8534901
  /*
  public static weightsPath =
    process.env["NODE_ENV"] == "development"
      ? "/assets/model/0_centauri_7_weights___48463_1500502.onnx"
      : process.env["NODE_ENV"] == "production"
        ? "https://github.com/cmorley191/expanse-model/releases/download/0.7.2/0_centauri_7_weights___48463_1500502.onnx"
        : (() => { throw `unexpected NODE_ENV`; })();
  */

  public static async initialize() {
    ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@dev/dist/';
    const session = await ort.InferenceSession.create(
      ExpanseModel_Sirius.weightsPath,
      { executionProviders: ['webgpu', 'wasm'] }
    );

    return new ExpanseModel_Sirius(session);
  }

  public async inferModelStateMcrWinProbs(inputs: ModelInput[]): Promise<number[]> {
    const batch = inputs.length;

    const obs_bool_array = new Uint8Array(batch * OBS_BOOL.LENGTH);
    const obs_int_array = new Int8Array(batch * OBS_INT.LENGTH);
    const obs_slot_index_array = new BigInt64Array(batch * OBS_SLOT_INDEX.COUNT);
    const obs_pile_present_array = new Uint8Array(batch * OBS_PILE_PRESENT.COUNT * EVENT_COUNT);

    obs_bool_array.set(inputs.map(i => i.obsBool).flat().map(Number));
    obs_int_array.set(inputs.map(i => i.obsInt).flat());
    obs_slot_index_array.set(inputs.map(i => i.obsSlotIndex.map(BigInt)).flat());
    obs_pile_present_array.set(inputs.map(i => i.obsPilePresent).flat().map(Number))

    const obs_bool = new ort.Tensor('bool', obs_bool_array, [batch, OBS_BOOL.LENGTH]);
    const obs_int = new ort.Tensor('int8', obs_int_array, [batch, OBS_INT.LENGTH]);
    const obs_slot_index = new ort.Tensor('int64', obs_slot_index_array, [batch, OBS_SLOT_INDEX.COUNT]);
    const obs_pile_present = new ort.Tensor('bool', obs_pile_present_array, [batch, OBS_PILE_PRESENT.COUNT, EVENT_COUNT]);

    const results = await this.session.run({ obs_bool, obs_int, obs_slot_index, obs_pile_present });

    const model_output = results['model_output'];
    if (model_output === undefined) throw `model_output not in results`;
    if (throwOnNullopt(model_output.dims.zip([batch, 2]), "unexpected output dims").some(([dim, expectedDim]) => dim != expectedDim)) throw `unexpected output dims`;
    if (model_output.type != "float32") throw `unexpected output type`;

    const model_output_array_data = model_output.data;
    if (!(model_output_array_data instanceof Float32Array)) throw `unexpected output.data type`;
    const model_output_array = Array.from(model_output_array_data).groupwise(2);

    if (model_output_array.length != batch) throw `unexpected output array length`;
    const mcr_win_array = model_output_array.map(out => 1 - normalCDF(0, out[0] ?? 0, out[1] ?? 0.000001));
    console.log({ model_output_array, mcr_win_array });

    return Array.from(mcr_win_array);
  }

};
