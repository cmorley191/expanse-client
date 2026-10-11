import { assertType, asType, clamp, identity, map2, map3, satisfiesCheck, withMap2, withMap3 } from "../core/misc";
import { nullopt, opt, Optional } from "../core/optional";
import { BandId, bands, BaseId, bases, bonusSectorBonusPoints, Card, CardType, EventId, events, FLEET_COUNT, OrbitalId, orbitals, PlayerId, players, ResourceId, SectorId, sectors, TRACK_COUNT, trackCost } from "./parameters";


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
  | { phase: "ap turn deciding miller", turn: PlayerId, focus: Exclude<EventId, EventIdKeepOnly> }
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

export type GameStateContinuation = {
  instructions: string,
  actions: {
    clickBase: Optional<GameState>[],
    clickOrbital: Optional<GameState>[],
    /// clickInfluence[base][player][amount_minus_1]
    clickInfluence: Optional<GameState>[][][],
    /// clickFleet[orbital][player][amount_minus_1]
    clickFleet: Optional<GameState>[][][],
    clickSector: Optional<GameState>[],
    clickBuildFleet: Optional<GameState>[],
    // clickKeptCard[player][iKept]
    clickKeptCard: Optional<GameState>[][],
    clickTrackCard: Optional<GameState>[],
    clickUseAP: Optional<GameState>,
    clickUseEvent: Optional<GameState>,
    clickKeepEvent: Optional<GameState>,
    clickPass: Optional<GameState>,
  },
};
const defaultContinuation: GameStateContinuation = {
  instructions: "",
  actions: {
    clickBase: bases.map(_ => nullopt),
    clickOrbital: orbitals.map(_ => nullopt),
    clickInfluence: bases.map(_ => players.map(_ => [])),
    clickFleet: orbitals.map(_ => players.map(_ => [])),
    clickSector: sectors.map(_ => nullopt),
    clickBuildFleet: players.map(_ => nullopt),
    clickKeptCard: players.map(_ => []),
    clickTrackCard: Array(TRACK_COUNT).fill(false).map(_ => nullopt),
    clickUseAP: nullopt,
    clickUseEvent: nullopt,
    clickKeepEvent: nullopt,
    clickPass: nullopt,
  },
};


function draw(oldState: GameState): GameState {
  const card = oldState.board.deck[0];
  if (card === undefined) throw `unexpected empty deck`;

  if (oldState.board.deck.slice(1).some(c => c.type === CardType.Score) === false) {
    return score(
      nullopt,
      {
        ...oldState,
        phase: { phase: "game over" },
        board: {
          ...oldState.board,
          cardTrack: oldState.board.cardTrack.concat({ type: CardType.Score }),
        },
      });

  } else {
    return {
      ...oldState,
      board: {
        ...oldState.board,
        cardTrack: oldState.board.cardTrack.concat(card),
        deck: oldState.board.deck.slice(1),
      },
    };
  }
}

function reduceAp(oldState: GameState): GameState {
  if (oldState.phase.phase === "ap turn ap") {
    if (oldState.phase.ap === 1) {
      if (
        oldState.board.kept[oldState.phase.turn].some(e => e == EventId.Miller)
        && events[oldState.phase.focus]?.factions[oldState.phase.turn]
        && oldState.phase.focus !== EventId.Miller
        && oldState.phase.focus !== EventId.MaoKwik
      ) {
        return {
          ...oldState,
          phase: {
            ...oldState.phase,
            phase: "ap turn deciding miller",
            focus: oldState.phase.focus,
          },
        };

      } else if (events[oldState.phase.focus]?.factions[players[oldState.phase.turn].opposite]) {
        return {
          ...oldState,
          phase: {
            ...oldState.phase,
            phase: "ap turn initiative deciding",
          },
        };

      } else {

        return draw({
          ...oldState,
          phase: {
            ...oldState.phase,
            phase: "start",
            turn: players[oldState.phase.turn].opposite,
            focus: nullopt,
          },
        });
      }

    } else {
      return {
        ...oldState,
        phase: {
          ...oldState.phase,
          ap: oldState.phase.ap - 1,
        },
      };
    }

  } else if (
    (
      oldState.phase.phase === "ap turn initiative event"
      || oldState.phase.phase === "event turn event"
      || oldState.phase.phase === "score turn kept event"
    )
    && (
      oldState.phase.focus === EventId.Drummer
      || oldState.phase.focus === EventId.Cotyar
    )
  ) {
    if (oldState.phase.ap === 1) {
      return endEvent({
        ...oldState,
        phase: oldState.phase,
      });

    } else {
      return {
        ...oldState,
        phase: {
          ...oldState.phase,
          ap: oldState.phase.ap - 1,
        },
      };
    }

  } else throw `can't reduce ap from this state`;
}

function score(bonusSector: Optional<SectorId>, oldState: GameState): GameState {
  const points = bases.map(base => {
    const fleets = oldState.board.fleets[base.orbital];
    const influence = oldState.board.influence[base.id];
    if (fleets === undefined || influence === undefined) throw `${oldState}`;

    const orbitalControlBonus = map2(players, p => fleets[p.id] > fleets[p.opposite] && influence[p.id] != 0 ? 1 : 0);
    const power = map2(orbitalControlBonus, (bonus, p) => influence[p] + bonus);
    return map2(players, (player): number =>
      (power[player.id] == 0)
        ? 0
        : (power[player.id] > power[players[player.id].opposite])
          ? 1 + (
            (bonusSector.hasValue && bands[orbitals[base.orbital]?.band ?? 0].sector == bonusSector.value)
              ? bonusSectorBonusPoints[6 - oldState.board.bonusSectorsRemaining.reduce((a, b) => a + b)]?.[0] ?? 0
              : 0
          )
          : (
            (bonusSector.hasValue && bands[orbitals[base.orbital]?.band ?? 0].sector == bonusSector.value)
              ? bonusSectorBonusPoints[6 - oldState.board.bonusSectorsRemaining.reduce((a, b) => a + b)]?.[1] ?? 0
              : 0
          )
    );
  }).reduce((a, b) => [a[0] + b[0], a[1] + b[1]]);

  return (bonusSector.hasValue ? draw : identity)({
    ...oldState,
    board: {
      ...oldState.board,
      cp: map2(oldState.board.cp, (cp, p) => cp + points[p]),
      fleets: players.reduce((fleets, player) =>
        fleets.withMap(player.homeOrbital, oFleets =>
          withMap2(oFleets, player.id, f =>
            f + ((oldState.board.fleets.map(o => o[player.id]).reduce((a, b) => a + b) < FLEET_COUNT) ? 1 : 0))),
        oldState.board.fleets),
    },
  });
}

function endEvent(oldState: GameState & { phase: GameStatePhaseEventPhase }): GameState {
  if (
    oldState.phase.phase === "ap turn initiative event"
    || oldState.phase.phase === "event turn event"
  ) {
    return ((oldState.board.cardTrack.length < TRACK_COUNT) ? draw : identity)({
      ...oldState,
      phase: {
        ...oldState.phase,
        phase: "start",
        turn: players[oldState.phase.turn].opposite,
        focus: nullopt,
      },
    });

  } else {
    assertType<"score turn kept event">(oldState.phase.phase);

    if (
      oldState.phase.action != oldState.phase.turn
      && oldState.board.kept[oldState.phase.turn].length > 0
    ) {
      return {
        ...oldState,
        phase: {
          ...oldState.phase,
          phase: "score turn kept event deciding",
          action: oldState.phase.turn,
        },
      };

    } else {
      return score(
        opt(oldState.phase.bonusSector),
        {
          ...oldState,
          phase: {
            ...oldState.phase,
            phase: "start",
            turn: players[oldState.phase.turn].opposite,
            focus: nullopt,
          },
        });
    }
  }
}

function startEvent(
  oldState: GameState & { phase: { phase: "start" | "ap turn deciding miller" | "ap turn initiative deciding" | "score turn kept event deciding" } },
  newPhaseWithEventPhase: (eventPhase: GameStateEventPhase) => (GameStatePhase & GameStatePhaseEventPhase),
  event: Exclude<EventId, EventIdKeepOnly>
): GameState {
  const immediatelyEndableEventPhase: GameStateEventPhase = { focus: EventId.Slingshot };

  const action =
    (
      oldState.phase.phase === "start"
      || oldState.phase.phase === "ap turn deciding miller"
    )
      ? oldState.phase.turn
      : oldState.phase.phase === "ap turn initiative deciding"
        ? players[oldState.phase.turn].opposite
        : oldState.phase.action;

  if (
    event === EventId.Drummer
    || event === EventId.Cotyar
  ) {
    return {
      ...oldState,
      phase: newPhaseWithEventPhase({
        focus: event,
        ap: (event === EventId.Drummer) ? 1 : satisfiesCheck<EventId.Cotyar>(event)(2),
        selectedFleetGroup: nullopt,
      }),
    };

  } else if (event === EventId.Assassin) {
    return {
      ...oldState,
      phase: newPhaseWithEventPhase({
        focus: event,
        assassinAction: action,
      }),
    };

  } else if (event === EventId.CovertOp) {
    return {
      ...oldState,
      phase: newPhaseWithEventPhase({
        focus: event,
        selectedInfluence: nullopt,
      }),
    };

  } else if (event === EventId.BushNaval) {
    return endEvent({
      ...oldState,
      phase: newPhaseWithEventPhase(immediatelyEndableEventPhase),
      board: {
        ...oldState.board,
        fleets: players.reduce(
          (newFleets, player) =>
            newFleets.withMap(
              player.homeOrbital, oFleets =>
              withMap2(oFleets, player.id, f =>
                f + FLEET_COUNT - oldState.board.fleets.map(f => f[player.id]).reduce((a, b) => a + b))),
          oldState.board.fleets
        ),
        cp: withMap2(oldState.board.cp, action, cp => cp + ((oldState.board.fleets.map(f => f[players[action].opposite]).reduce((a, b) => a + b) < FLEET_COUNT) ? 1 : 0)),
      },
    });

  } else if (
    event === EventId.AntonyDresden
    || event === EventId.FranklinDeGraff
    || event === EventId.Terraforming
  ) {
    return endEvent({
      ...oldState,
      phase: newPhaseWithEventPhase(immediatelyEndableEventPhase),
      board: {
        ...oldState.board,
        influence:
          bases
            .filter(b =>
              event === EventId.AntonyDresden
                ? b.resource === ResourceId.Tech
                : event === EventId.FranklinDeGraff
                  ? b.orbital === OrbitalId.Earth
                  : satisfiesCheck<EventId.Terraforming>(event)(b.orbital === OrbitalId.Mars)
            ).reduce(
              (influence, base) =>
                influence.withMap(base.id, bInfluence =>
                  withMap2(bInfluence, action, i => i + 1)),
              oldState.board.influence)
      },
    });

  } else if (event === EventId.VoicesEros) {
    return {
      ...oldState,
      phase: newPhaseWithEventPhase({
        focus: event,
        placingSector: SectorId.Inner,
      }),
    };

  } else if (event === EventId.DestructionDeimos) {
    return {
      ...oldState,
      board: {
        ...oldState.board,
        influence: bases.filter(b => b.orbital === OrbitalId.Mars && (oldState.board.influence[b.id]?.reduce((a, b) => a + b) ?? 0) > 0).reduce(
          (influence, base) =>
            influence.withMap(base.id, bInfluence =>
              withMap2(
                bInfluence,
                bInfluence[players[action].opposite] > 0 ? players[action].opposite : action,
                i => i - 1))
          , oldState.board.influence
        ),
      },
      phase: newPhaseWithEventPhase({
        focus: event,
      }),
    };

  } else if (
    event === EventId.BlockadeEarth
    || event === EventId.BlockadeMars
  ) {
    return {
      ...oldState,
      phase: newPhaseWithEventPhase({
        focus: event,
        placing: true,
      }),
    };

  } else if (event === EventId.SadavirErrinwright) {
    return endEvent({
      ...oldState,
      phase: newPhaseWithEventPhase(immediatelyEndableEventPhase),
      board: {
        ...oldState.board,
        influence: oldState.board.influence.map(bInfluence =>
          map2(bInfluence, i => Math.min(i, 2))),
      },
    });

  } else if (
    event === EventId.Slingshot
    || event === EventId.Nauvoo
    || event === EventId.TheresaYao
    || event === EventId.CaptainYvgeny
  ) {
    return {
      ...oldState,
      phase: newPhaseWithEventPhase({ focus: event }),
    };

  } else if (event === EventId.BlackOps) {
    return {
      ...oldState,
      phase: newPhaseWithEventPhase({
        focus: event,
        remaining: 3,
        bandPermitted: bands.map(_ => true),
      }),
    };

  } else if (event === EventId.JulieMao) {
    return {
      ...oldState,
      phase: newPhaseWithEventPhase({
        focus: event,
        removedBase: nullopt,
      }),
    };

  } else if (event === EventId.StarHelix) {
    return {
      ...oldState,
      phase: newPhaseWithEventPhase({
        focus: event,
        remaining: 2,
      }),
    };

  } else if (event === EventId.RiotGear) {
    return {
      ...oldState,
      phase: newPhaseWithEventPhase({
        focus: event,
        removedBase: nullopt,
      }),
    };

  } else if (event === EventId.TheHybrid) {
    return {
      ...oldState,
      phase: newPhaseWithEventPhase({
        focus: event,
        selected: nullopt,
      }),
    };

  } else if (event === EventId.BobbieDraper) {
    return {
      ...oldState,
      phase: newPhaseWithEventPhase({
        focus: event,
        removedOrbital: nullopt,
      }),
    };

  } else if (event === EventId.Ambush) {
    return {
      ...oldState,
      phase: newPhaseWithEventPhase({
        focus: event,
        removed: nullopt,
      }),
    };

  } else if (event === EventId.StealthShips) {
    return {
      ...oldState,
      phase: newPhaseWithEventPhase({
        focus: event,
        selectedFleet: nullopt,
      }),
    };

  } else if (event === EventId.HeavyBurn) {
    return {
      ...oldState,
      phase: newPhaseWithEventPhase({
        focus: event,
        remaining: 2,
        fleetsPermitted: oldState.board.fleets.map(oFleets => oFleets[action]),
        selectedFleetGroup: nullopt,
      }),
    };

  } else if (event === EventId.Razorback) {
    return {
      ...oldState,
      phase: newPhaseWithEventPhase({
        focus: event,
        selectedFleet: nullopt,
      }),
    };

  } else if (event === EventId.AdmiralSouther) {
    return {
      ...oldState,
      phase: newPhaseWithEventPhase({
        focus: event,
        remaining: oldState.board.fleets.map(f => f[action]).reduce((a, b) => a + b),
        fleetsPermitted: oldState.board.fleets.map(f => f[action]),
        selectedFleetGroup: nullopt,
      }),
    };

  }

  assertType<never>(event);
  return event;
}

function apContinuation(oldState: GameState & { phase: GameStateAPPhase }, action: PlayerId) {
  const selectedFleetGroup = oldState.phase.selectedFleetGroup;
  if (selectedFleetGroup.hasValue === false) {
    return {
      ...defaultContinuation,
      instructions: `${players[action].name}, you have ${oldState.phase.ap} AP remaining. Place influence, move fleets, or build a fleet.`,
      actions: {
        ...defaultContinuation.actions,

        clickBase: bases.map(base =>
          oldState.board.fleets[orbitals[base.orbital]?.id ?? 0]?.[action] === 0
            ? nullopt
            : opt(reduceAp({
              ...oldState,
              board: {
                ...oldState.board,
                influence:
                  oldState.board.influence
                    .withMap(
                      base.id,
                      bInfluence => withMap2(bInfluence, action, i => i + 1)
                    ),
              },
            })),
        ),

        clickFleet: defaultContinuation.actions.clickFleet.map((oActions, orbital) =>
          oActions.with(action, Array(oldState.board.fleets[orbital]?.[action]).fill(false).map((_, iFleet) => opt({
            ...oldState,
            phase: {
              ...oldState.phase,
              selectedFleetGroup: opt({
                orbital,
                count: iFleet + 1,
              }),
            },
          })))),

        clickBuildFleet: defaultContinuation.actions.clickBuildFleet.with(action,
          oldState.board.fleets.map(oFleets => oFleets[action]).reduce((a, b) => a + b) == FLEET_COUNT
            ? nullopt
            : opt(reduceAp({
              ...oldState,
              phase: oldState.phase,
              board: {
                ...oldState.board,
                fleets: oldState.board.fleets.withMap(players[action].homeOrbital, oFleets => withMap2(oFleets, action, f => f + 1)),
              },
            }))),

        clickPass: opt(reduceAp({
          ...oldState,
          phase: asType<typeof oldState.phase>()({  // idk why we need this but compiler says we do
            ...oldState.phase,
            ap: 1,
          }),
        })),
      },
    };
  }

  else {
    return {
      ...defaultContinuation,
      instructions: `${players[action].name}, you have ${oldState.phase.ap} AP remaining. Select a destination for your fleet.`,
      actions: {
        ...defaultContinuation.actions,

        clickOrbital: orbitals.map(orbital =>
          (Math.abs(orbital.band - (orbitals[selectedFleetGroup.value.orbital]?.band ?? 0)) > 1)
            ? nullopt
            : opt(reduceAp({
              ...oldState,
              board: {
                ...oldState.board,
                fleets:
                  oldState.board.fleets
                    .withMap(
                      selectedFleetGroup.value.orbital,
                      oFleets => withMap2(oFleets, action, f => f - selectedFleetGroup.value.count)
                    )
                    .withMap(
                      orbital.id,
                      oFleets => withMap2(oFleets, action, f => f + selectedFleetGroup.value.count)
                    ),
              },
              phase: asType<typeof oldState.phase>()({  // idk why we need this but compiler says we do
                ...oldState.phase,
                selectedFleetGroup: nullopt,
              }),
            }))
        ),
      },
    };
  }
}

export function getContinuation(oldState: GameState): GameStateContinuation {
  const oldPhase = oldState.phase;
  if (oldPhase.phase === "game over") {
    return {
      ...defaultContinuation,
      instructions: "Game over!",
    };
  }

  else if (oldPhase.phase === "start") {
    if (oldPhase.focus.hasValue === false) {
      return {
        ...defaultContinuation,
        instructions: `${players[oldPhase.turn].name}, choose ${oldState.board.kept[oldPhase.turn].length !== 0 ? "a kept card or " : ""}a track card.`,
        actions: {
          ...defaultContinuation.actions,

          clickTrackCard: oldState.board.cardTrack.map((card, iTrack) =>
            oldState.board.cp[oldPhase.turn] < (trackCost[iTrack] ?? 0)
              ? nullopt
              : opt({
                ...oldState,
                board: {
                  ...oldState.board,
                  cp: withMap2(oldState.board.cp, oldPhase.turn, cp => cp - (trackCost[iTrack] ?? 0)),
                  cardTrack: oldState.board.cardTrack.slice(0, iTrack).concat(oldState.board.cardTrack.slice(iTrack + 1)),
                },
                phase:
                  card.type === CardType.Event
                    ? {
                      ...oldPhase,
                      phase: "start",
                      focus: opt(card.event),
                    }
                    : {
                      ...oldPhase,
                      phase: "score turn deciding sector",
                    },
              }),
          ),

          clickKeptCard: defaultContinuation.actions.clickKeptCard.with(oldPhase.turn, oldState.board.kept[oldPhase.turn].map(kept =>
            (
              kept === EventId.Miller
              || kept === EventId.MaoKwik
            )
              ? nullopt
              : opt(startEvent(
                {
                  ...oldState,
                  phase: oldPhase,
                  board: {
                    ...oldState.board,
                    kept: withMap2(oldState.board.kept, oldPhase.turn, k => k.filter(k => k != kept)),
                  },
                },
                eventPhase => ({
                  ...oldPhase,
                  ...eventPhase,
                  phase: "event turn event",
                }),
                kept
              )))),
        },
      };
    }

    else {
      const focus = oldPhase.focus;
      return {
        ...defaultContinuation,
        instructions: `${players[oldPhase.turn].name}, choose what to do with the card.`,
        actions: {
          ...defaultContinuation.actions,

          clickUseAP: opt(
            (oldState.board.kept[oldPhase.turn].some(k => k === EventId.MaoKwik))
              ? {
                ...oldState,
                phase: {
                  ...oldPhase,
                  phase: "ap turn deciding mao-kwik",
                  focus: oldPhase.focus.value,
                },
              }
              : {
                ...oldState,
                phase: {
                  ...oldPhase,
                  phase: "ap turn ap",
                  focus: oldPhase.focus.value,
                  ap: events[oldPhase.focus.value]?.ap ?? 0,
                  selectedFleetGroup: nullopt,
                },
              }),

          clickUseEvent: (
            (
              oldPhase.focus.value == EventId.Miller
              || oldPhase.focus.value == EventId.MaoKwik
              || events[oldPhase.focus.value]?.factions[oldPhase.turn] === false
            )
              ? nullopt
              : opt(startEvent(
                {
                  ...oldState,
                  phase: oldPhase,
                },
                eventPhase => ({
                  ...oldPhase,
                  ...eventPhase,
                  phase: "event turn event",
                }),
                oldPhase.focus.value
              ))),

          clickKeepEvent: (
            (
              oldState.board.cp[oldPhase.turn] < (events[oldPhase.focus.value]?.keepCost ?? 0)
              || events[oldPhase.focus.value]?.factions[oldPhase.turn] === false
            )
              ? nullopt
              : opt(draw({
                ...oldState,
                board: {
                  ...oldState.board,
                  cp: withMap2(oldState.board.cp, oldPhase.turn, (cp) => cp - (events[focus.value]?.keepCost ?? 0)),
                  kept: withMap2(oldState.board.kept, oldPhase.turn, (kept) => kept.concat(focus.value)),
                },
                phase: {
                  ...oldPhase,
                  phase: "start",
                  turn: players[oldPhase.turn].opposite,
                  focus: nullopt,
                },
              }))),
        },
      };
    }
  }

  else if (oldPhase.phase === "ap turn ap") {
    return apContinuation({ ...oldState, phase: oldPhase }, oldPhase.turn);
  }

  else if (oldPhase.phase === "ap turn deciding mao-kwik") {
    return {
      ...defaultContinuation,
      instructions: `${players[oldPhase.turn].name}, choose whether to use the card's AP, or 4 AP from kept ${events[EventId.MaoKwik]?.title}.`,
      actions: {
        ...defaultContinuation.actions,

        clickKeptCard: defaultContinuation.actions.clickKeptCard.with(oldPhase.turn, oldState.board.kept[oldPhase.turn].map(kept =>
          kept !== EventId.MaoKwik
            ? nullopt
            : opt({
              ...oldState,
              board: {
                ...oldState.board,
                kept: withMap2(oldState.board.kept, oldPhase.turn, filterKept => filterKept.filter(k => k != EventId.MaoKwik)),
              },
              phase: {
                ...oldPhase,
                phase: "ap turn ap",
                ap: 4,
                selectedFleetGroup: nullopt,
              },
            }))),

        clickUseAP: opt({
          ...oldState,
          phase: {
            ...oldPhase,
            phase: "ap turn ap",
            focus: oldPhase.focus,
            ap: events[oldPhase.focus]?.ap ?? 0,
            selectedFleetGroup: nullopt,
          },
        }),
      },
    };
  }

  else if (oldPhase.phase === "ap turn deciding miller") {
    return {
      ...defaultContinuation,
      instructions: `${players[oldPhase.turn].name}, choose whether to pass initiative to the other player, or use kept ${events[EventId.Miller]?.title} to use the card's event.`,
      actions: {
        ...defaultContinuation.actions,

        clickKeptCard: defaultContinuation.actions.clickKeptCard.with(oldPhase.turn, oldState.board.kept[oldPhase.turn].map(kept =>
          kept !== EventId.Miller
            ? nullopt
            : opt(startEvent(
              {
                ...oldState,
                phase: oldPhase,
                board: {
                  ...oldState.board,
                  kept: withMap2(oldState.board.kept, oldPhase.turn, filterKept => filterKept.filter(k => k != EventId.Miller)),
                },
              },
              eventPhase => ({
                ...oldPhase,
                ...eventPhase,
                phase: "event turn event",
              }),
              oldPhase.focus
            )))),

        clickPass: opt({
          ...oldState,
          phase: {
            ...oldPhase,
            phase: "ap turn initiative deciding",
          },
        }),
      },
    };
  }

  else if (oldPhase.phase === "ap turn initiative deciding") {
    const oldAction = players[oldPhase.turn].opposite;
    return {
      ...defaultContinuation,
      instructions: `${players[oldAction].name}, choose what to do with the card's event.`,
      actions: {
        ...defaultContinuation.actions,

        clickUseEvent: (
          (
            oldPhase.focus === EventId.MaoKwik
            || oldPhase.focus === EventId.Miller
          )
            ? nullopt
            : opt(startEvent(
              {
                ...oldState,
                phase: oldPhase,
              },
              eventPhase => ({
                ...oldPhase,
                ...eventPhase,
                phase: "ap turn initiative event",
              }),
              oldPhase.focus
            ))),

        clickKeepEvent: opt(draw({
          ...oldState,
          board: {
            ...oldState.board,
            cp: withMap2(oldState.board.cp, oldAction, (cp) => cp - (events[oldPhase.focus]?.keepCost ?? 0)),
            kept: withMap2(oldState.board.kept, oldAction, (kept) => kept.concat(oldPhase.focus)),
          },
          phase: {
            ...oldPhase,
            phase: "start",
            turn: oldAction,
            focus: nullopt,
          },
        })),

        clickPass: opt(draw({
          ...oldState,
          phase: {
            ...oldPhase,
            phase: "start",
            turn: oldAction,
            focus: nullopt,
          },
        }))
      },
    };
  }

  else if (oldPhase.phase === "score turn deciding sector") {
    return {
      ...defaultContinuation,
      instructions: `${players[oldPhase.turn].name}, choose a sector to receive bonus scoring.`,
      actions: {
        ...defaultContinuation.actions,

        clickSector: map3(oldState.board.bonusSectorsRemaining, (remaining, sector) =>
          (remaining === 0)
            ? nullopt
            : opt(
              (oldState.board.kept[players[oldPhase.turn].opposite].length != 0)
                ? {
                  ...oldState,
                  phase: {
                    ...oldPhase,
                    phase: "score turn kept event deciding",
                    bonusSector: sector,
                    action: players[oldPhase.turn].opposite,
                  },
                }
                : (oldState.board.kept[oldPhase.turn].length != 0)
                  ? {
                    ...oldState,
                    phase: {
                      ...oldPhase,
                      phase: "score turn kept event deciding",
                      bonusSector: sector,
                      action: oldPhase.turn,
                    },
                  }
                  : score(
                    opt(sector),
                    {
                      ...oldState,
                      board: {
                        ...oldState.board,
                        bonusSectorsRemaining: withMap3(oldState.board.bonusSectorsRemaining, sector, r => r - 1),
                      },
                      phase: {
                        ...oldPhase,
                        phase: "start",
                        turn: players[oldPhase.turn].opposite,
                        focus: nullopt,
                      },
                    }))),
      },
    };
  }

  else if (oldPhase.phase === "score turn kept event deciding") {
    return {
      ...defaultContinuation,
      instructions: `${players[oldPhase.action].name}, you may play a kept event before scoring.`,
      actions: {
        ...defaultContinuation.actions,

        clickKeptCard: defaultContinuation.actions.clickKeptCard.with(oldPhase.action, oldState.board.kept[oldPhase.action].map(kept =>
          (
            kept === EventId.MaoKwik
            || kept === EventId.Miller
          )
            ? nullopt
            : opt(startEvent(
              {
                ...oldState,
                phase: oldPhase,
                board: {
                  ...oldState.board,
                  kept: withMap2(oldState.board.kept, oldPhase.action, filterKept => filterKept.filter(k => k != kept)),
                },
              },
              eventPhase => ({
                ...oldPhase,
                ...eventPhase,
                phase: "score turn kept event",
              }),
              kept
            )))),

        clickPass: opt(
          (
            oldPhase.action != oldPhase.turn
            && oldState.board.kept[oldPhase.turn].length > 0
          )
            ? {
              ...oldState,
              phase: {
                ...oldPhase,
                action: oldPhase.turn,
              },
            }
            : score(
              opt(oldPhase.bonusSector), {
              ...oldState,
              board: {
                ...oldState.board,
                bonusSectorsRemaining: withMap3(oldState.board.bonusSectorsRemaining, oldPhase.bonusSector, r => r - 1),
              },
              phase: {
                ...oldPhase,
                phase: "start",
                turn: players[oldPhase.turn].opposite,
                focus: nullopt,
              },
            })),
      },
    };
  }

  else if (
    oldPhase.phase === "ap turn initiative event"
    || oldPhase.phase === "event turn event"
    || oldPhase.phase === "score turn kept event"
  ) {
    const eventPlayer =
      oldPhase.phase === "ap turn initiative event"
        ? players[oldPhase.turn].opposite
        : oldPhase.phase === "event turn event"
          ? oldPhase.turn
          : satisfiesCheck<"score turn kept event">(oldPhase.phase)(oldPhase.action);

    if (
      oldPhase.focus === EventId.Drummer
      || oldPhase.focus === EventId.Cotyar
    ) {
      return apContinuation({ ...oldState, phase: oldPhase }, eventPlayer);
    }

    else if (oldPhase.focus === EventId.Assassin) {
      return {
        ...defaultContinuation,
        instructions: `${players[oldPhase.assassinAction].name}, choose a kept card to discard.`,
        actions: {
          ...defaultContinuation.actions,

          clickKeptCard: defaultContinuation.actions.clickKeptCard.with(oldPhase.assassinAction, oldState.board.kept[oldPhase.assassinAction].map(kept =>
            (
              kept === EventId.MaoKwik
              || kept === EventId.Miller
            )
              ? nullopt
              : opt(
                (
                  (
                    oldPhase.assassinAction == eventPlayer
                    && oldState.board.kept[players[oldPhase.assassinAction].opposite].length > 0
                  )
                    ? identity
                    : endEvent
                )({
                  ...oldState,
                  board: {
                    ...oldState.board,
                    kept: withMap2(oldState.board.kept, oldPhase.assassinAction, filterKept => filterKept.filter(k => k != kept))
                  },
                  phase: {
                    ...oldPhase,
                    assassinAction: players[oldPhase.assassinAction].opposite,
                  },
                })))),
        },
      };
    }

    else if (oldPhase.focus === EventId.CovertOp) {
      const oldSelectedInfluence = oldPhase.selectedInfluence;
      return {
        ...defaultContinuation,
        instructions: `${players[eventPlayer].name}, choose two influence to swap positions.`,
        actions: {
          ...defaultContinuation.actions,

          clickInfluence: oldState.board.influence.map((bInfluence, base) => map2(bInfluence, (influence, player) =>
            Array(influence).fill(
              (
                oldSelectedInfluence.hasValue === false
              )
                ? opt({
                  ...oldState,
                  phase: {
                    ...oldPhase,
                    selectedInfluence: opt({ base, player }),
                  },
                })
                : (oldSelectedInfluence.value.player === player)
                  ? nullopt
                  : opt(endEvent({
                    ...oldState,
                    phase: oldPhase,
                    board: {
                      ...oldState.board,
                      influence:
                        oldState.board.influence
                          .withMap(oldSelectedInfluence.value.base, bInfluence =>
                            withMap2(withMap2(bInfluence,
                              oldSelectedInfluence.value.player, i => i - 1),
                              player, i => i + 1))
                          .withMap(base, bInfluence =>
                            withMap2(withMap2(bInfluence,
                              player, i => i - 1),
                              oldSelectedInfluence.value.player, i => i + 1)),
                    },
                  }))))),
        },
      };
    }

    else if (oldPhase.focus === EventId.VoicesEros) {
      return {
        ...defaultContinuation,
        instructions: `${players[eventPlayer].name}, place an influence in ${sectors[oldPhase.placingSector].name}.`,
        actions: {
          ...defaultContinuation.actions,

          clickBase: bases.map(base =>
            (bands[orbitals[base.orbital]?.band ?? 0].sector != oldPhase.placingSector)
              ? nullopt
              : opt((oldPhase.placingSector == SectorId.Outer ? endEvent : identity)({
                ...oldState,
                board: {
                  ...oldState.board,
                  influence: oldState.board.influence.withMap(base.id, bInfluence => withMap2(bInfluence, eventPlayer, i => i + 1)),
                },
                phase: {
                  ...oldPhase,
                  placingSector: oldPhase.placingSector + 1,
                },
              }))),
        },
      };
    }

    else if (oldPhase.focus === EventId.DestructionDeimos) {
      return {
        ...defaultContinuation,
        instructions: `${players[eventPlayer].name}, place influence on an Earth base.`,
        actions: {
          ...defaultContinuation.actions,

          clickBase: bases.map(base =>
            (base.orbital !== OrbitalId.Earth)
              ? nullopt
              : opt(endEvent({
                ...oldState,
                phase: oldPhase,
                board: {
                  ...oldState.board,
                  influence: oldState.board.influence.withMap(base.id, bInfluence => withMap2(bInfluence, eventPlayer, i => i + 1)),
                },
              }))),
        },
      };
    }

    else if (
      oldPhase.focus === EventId.BlockadeEarth
      || oldPhase.focus === EventId.BlockadeMars
    ) {
      const orbital =
        oldPhase.focus === EventId.BlockadeEarth
          ? OrbitalId.Earth
          : OrbitalId.Mars;

      if (oldPhase.placing) {
        return {
          ...defaultContinuation,
          instructions: `${players[eventPlayer].name}, place influence in ${orbitals[orbital]?.name}.`,
          actions: {
            ...defaultContinuation.actions,

            clickBase: bases.map(base =>
              (base.orbital !== orbital)
                ? nullopt
                : opt(
                  (
                    (
                      (oldState.board.fleets[orbital]?.[eventPlayer] ?? 0)
                      > (oldState.board.fleets[orbital]?.[players[eventPlayer].opposite] ?? 0)
                    )
                      ? identity
                      : endEvent
                  )({
                    ...oldState,
                    board: {
                      ...oldState.board,
                      influence: oldState.board.influence.withMap(base.id, bInfluence => withMap2(bInfluence, eventPlayer, i => i + 1)),
                    },
                    phase: {
                      ...oldPhase,
                      placing: false,
                    },
                  })
                )),
          },
        };

      } else {
        return {
          ...defaultContinuation,
          instructions: `${players[eventPlayer].opposite}, remove an influence from ${orbitals[orbital]?.name}.`,
          actions: {
            ...defaultContinuation.actions,

            clickBase: bases.map(base =>
              (base.orbital !== orbital)
                ? nullopt
                : ((oldState.board.influence[base.id]?.reduce((a, b) => a + b) ?? 0) == 0)
                  ? nullopt
                  : opt(endEvent({
                    ...oldState,
                    phase: oldPhase,
                    board: {
                      ...oldState.board,
                      influence: oldState.board.influence.withMap(base.id, bInfluence => withMap2(
                        bInfluence,
                        bInfluence[players[eventPlayer].opposite] > 0 ? players[eventPlayer].opposite : eventPlayer,
                        i => i - 1)),
                    },
                  }))),

            clickPass: opt(endEvent({
              ...oldState,
              phase: oldPhase,
            })),
          },
        };
      }
    }

    else if (oldPhase.focus === EventId.Slingshot) {
      return {
        ...defaultContinuation,
        instructions: `${players[eventPlayer].name}, remove an influence in ${sectors[SectorId.Outer].name}.`,
        actions: {
          ...defaultContinuation.actions,

          clickBase: bases.map(base =>
            (bands[orbitals[base.orbital]?.band ?? 0].sector !== SectorId.Outer)
              ? nullopt
              : opt(endEvent({
                ...oldState,
                phase: oldPhase,
                board: {
                  ...oldState.board,
                  influence: oldState.board.influence.withMap(base.id, bInfluence =>
                    withMap2(
                      bInfluence,
                      bInfluence[players[eventPlayer].opposite] > 0 ? players[eventPlayer].opposite : eventPlayer,
                      i => i - 1)),
                },
              }))),
        },
      };
    }

    else if (oldPhase.focus === EventId.BlackOps) {
      return {
        ...defaultContinuation,
        instructions: `${players[eventPlayer].name}, you may remove ${oldPhase.remaining} more influence from ${bands.filter(band => oldPhase.bandPermitted[band.id]).map(band => band.name).join(" or ")}.`,
        actions: {
          ...defaultContinuation.actions,

          clickBase: bases.map(base =>
            (
              (oldPhase.bandPermitted[orbitals[base.orbital]?.band ?? 0] === false)
              || (oldState.board.influence[base.id]?.[players[eventPlayer].opposite] == 0)
            )
              ? nullopt
              : opt((oldPhase.remaining == 1 ? endEvent : identity)({
                ...oldState,
                phase: {
                  ...oldPhase,
                  remaining: oldPhase.remaining - 1,
                  bandPermitted: oldPhase.bandPermitted.with(orbitals[base.orbital]?.band ?? 0, false),
                },
                board: {
                  ...oldState.board,
                  influence: oldState.board.influence.withMap(base.id, bInfluence => withMap2(bInfluence, players[eventPlayer].opposite, i => i - 1)),
                },
              }))),

          clickPass: opt(endEvent({
            ...oldState,
            phase: oldPhase,
          })),
        },
      };
    }

    else if (oldPhase.focus === EventId.JulieMao) {
      return {
        ...defaultContinuation,
        instructions: `${players[eventPlayer].name}, remove influence from 2 bases with the same resource.`,
        actions: {
          ...defaultContinuation.actions,

          clickBase: bases.map(base =>
            (
              (oldState.board.influence[base.id]?.reduce((a, b) => a + b) == 0)
              || (
                oldPhase.removedBase.hasValue
                && (
                  base.id == oldPhase.removedBase.value
                  || base.resource != bases[oldPhase.removedBase.value]?.resource
                )
              )
            )
              ? nullopt
              : opt((oldPhase.removedBase.hasValue ? endEvent : identity)({
                ...oldState,
                phase: {
                  ...oldPhase,
                  removedBase: opt(base.id),
                },
                board: {
                  ...oldState.board,
                  influence: oldState.board.influence.withMap(base.id, bInfluence => withMap2(
                    bInfluence,
                    bInfluence[players[eventPlayer].opposite] > 0 ? players[eventPlayer].opposite : eventPlayer,
                    i => i - 1
                  )),
                },
              }))),
        },
      };
    }

    else if (oldPhase.focus === EventId.StarHelix) {
      return {
        ...defaultContinuation,
        instructions: `${players[eventPlayer].name}, you may remove ${oldPhase.remaining} more influence where you have influence.`,
        actions: {
          ...defaultContinuation.actions,

          clickBase: bases.map(base =>
            (oldState.board.influence[base.id]?.some(i => i == 0))
              ? nullopt
              : opt((oldPhase.remaining == 1 ? endEvent : identity)({
                ...oldState,
                phase: {
                  ...oldPhase,
                  remaining: oldPhase.remaining - 1,
                },
                board: {
                  ...oldState.board,
                  influence: oldState.board.influence.withMap(base.id, bInfluence => withMap2(bInfluence, players[eventPlayer].opposite, i => i - 1)),
                },
              }))),

          clickPass: opt(endEvent({
            ...oldState,
            phase: oldPhase,
          })),
        },
      };
    }

    else if (oldPhase.focus === EventId.RiotGear) {
      return {
        ...defaultContinuation,
        instructions: `${players[eventPlayer].name}, you may remove ${oldPhase.removedBase.hasValue ? 1 : 2} more influence from ${sectors[SectorId.Belt].name}.`,
        actions: {
          ...defaultContinuation.actions,

          clickBase: bases.map(base =>
            (
              orbitals[base.orbital]?.band != BandId.Belt
              || oldState.board.influence[base.id]?.[players[eventPlayer].opposite] == 0
            )
              ? nullopt
              : opt((oldPhase.removedBase.hasValue ? endEvent : identity)({
                ...oldState,
                phase: {
                  ...oldPhase,
                  removedBase: opt(base.id),
                },
                board: {
                  ...oldState.board,
                  influence: oldState.board.influence.withMap(base.id, bInfluence => withMap2(bInfluence, players[eventPlayer].opposite, i => i - 1)),
                },
              }))),

          clickPass: opt(endEvent({
            ...oldState,
            phase: oldPhase,
          })),
        },
      };
    }

    else if (oldPhase.focus === EventId.TheHybrid) {
      const oldSelected = oldPhase.selected;
      if (oldSelected.hasValue === false) {
        const topCard = oldState.board.deck[0];
        if (topCard === undefined) throw `empty deck`;
        return {
          ...defaultContinuation,
          instructions: `${players[eventPlayer].name}, select a base to target.`,
          actions: {
            ...defaultContinuation.actions,

            clickBase:
              (
                topCard.type === CardType.Event
                && oldState.board.kept[eventPlayer].some(k => k === EventId.MaoKwik)
              )
                ? bases.map(base => opt({
                  ...oldState,
                  phase: {
                    ...oldPhase,
                    selected: opt({
                      base: base.id,
                      topEvent: topCard.event,
                    }),
                  },
                }))
                : bases.map(base => opt(endEvent({
                  ...oldState,
                  phase: oldPhase,
                  board: {
                    ...oldState.board,
                    influence: oldState.board.influence.withMap(base.id, bInfluence =>
                      withMap2(withMap2(bInfluence,
                        players[eventPlayer].opposite, i => topCard.type === CardType.Score ? 0 : Math.max(0, i - (events[topCard.event]?.ap ?? 0))),
                        eventPlayer, i => topCard.type === CardType.Score ? 0 : clamp(0, i, i - (events[topCard.event]?.ap ?? 0) + bInfluence[players[eventPlayer].opposite])))
                  },
                }))),
          },
        };

      } else {
        return {
          ...defaultContinuation,
          instructions: `${players[eventPlayer].name}, decide whether to remove the card AP's influence, or use kept ${events[EventId.MaoKwik]?.title} to remove 4.`,
          actions: {
            ...defaultContinuation.actions,

            clickKeptCard: defaultContinuation.actions.clickKeptCard.with(eventPlayer, oldState.board.kept[eventPlayer].map(kept =>
              kept != EventId.MaoKwik
                ? nullopt
                : opt(endEvent({
                  ...oldState,
                  phase: oldPhase,
                  board: {
                    ...oldState.board,
                    kept: withMap2(oldState.board.kept, eventPlayer, filterKept => filterKept.filter(k => k != EventId.MaoKwik)),
                    influence: oldState.board.influence.withMap(oldSelected.value.base, bInfluence =>
                      withMap2(withMap2(bInfluence,
                        players[eventPlayer].opposite, i => Math.max(0, i - 4)),
                        eventPlayer, i => clamp(0, i, i - 4 + bInfluence[players[eventPlayer].opposite])))
                  },
                })))),

            clickUseAP: opt(endEvent({
              ...oldState,
              phase: oldPhase,
              board: {
                ...oldState.board,
                influence: oldState.board.influence.withMap(oldSelected.value.base, bInfluence =>
                  withMap2(withMap2(bInfluence,
                    players[eventPlayer].opposite, i => Math.max(0, i - (events[oldSelected.value.topEvent]?.ap ?? 0))),
                    eventPlayer, i => clamp(0, i, i - (events[oldSelected.value.topEvent]?.ap ?? 0) + bInfluence[players[eventPlayer].opposite])))
              },
            })),
          },
        };
      }
    }

    else if (oldPhase.focus === EventId.Nauvoo) {
      return {
        ...defaultContinuation,
        instructions: `${players[eventPlayer].name}, remove an influence or fleet.`,
        actions: {
          ...defaultContinuation.actions,

          clickBase: oldState.board.influence.map((bInfluence, base) =>
            bInfluence[players[eventPlayer].opposite] == 0
              ? nullopt
              : opt(endEvent({
                ...oldState,
                phase: oldPhase,
                board: {
                  ...oldState.board,
                  influence: oldState.board.influence.with(base, withMap2(bInfluence, players[eventPlayer].opposite, i => i - 1)),
                },
              }))),

          clickOrbital: oldState.board.fleets.map((oFleets, orbital) =>
            oFleets[players[eventPlayer].opposite] == 0
              ? nullopt
              : opt(endEvent({
                ...oldState,
                phase: oldPhase,
                board: {
                  ...oldState.board,
                  fleets: oldState.board.fleets.with(orbital, withMap2(oFleets, players[eventPlayer].opposite, i => i - 1)),
                },
              }))),
        },
      };
    }

    else if (oldPhase.focus === EventId.TheresaYao) {
      return {
        ...defaultContinuation,
        instructions: `${players[eventPlayer].name}, select fleets to attack.`,
        actions: {
          ...defaultContinuation.actions,

          clickFleet: defaultContinuation.actions.clickFleet.map((orbitalActions, orbital) => orbitalActions.with(players[eventPlayer].opposite,
            Array(oldState.board.fleets[orbital]?.[players[eventPlayer].opposite]).fill(false).map((_, iFleet) =>
              (iFleet >= (oldState.board.fleets[orbital]?.[eventPlayer] ?? 0))
                ? nullopt
                : opt(endEvent({
                  ...oldState,
                  phase: oldPhase,
                  board: {
                    ...oldState.board,
                    fleets: oldState.board.fleets.withMap(orbital, oFleets =>
                      withMap2(withMap2(oFleets,
                        eventPlayer, f => f - iFleet),
                        players[eventPlayer].opposite, f => f - (iFleet + 1))),
                  },
                }))))),

          clickPass: opt(endEvent({
            ...oldState,
            phase: oldPhase,
          })),
        },
      };
    }

    else if (oldPhase.focus === EventId.BobbieDraper) {
      if (
        oldState.board.fleets.map(oFleets => oFleets[eventPlayer]).reduce((a, b) => a + b) < FLEET_COUNT
        || oldPhase.removedOrbital.hasValue
      ) {
        return {
          ...defaultContinuation,
          instructions: `${players[eventPlayer].name}, select a fleet to board.`,
          actions: {
            ...defaultContinuation.actions,

            clickOrbital: oldState.board.fleets.map((oFleets, orbital) =>
              oFleets[players[eventPlayer].opposite] == 0
                ? nullopt
                : opt(endEvent({
                  ...oldState,
                  phase: oldPhase,
                  board: {
                    ...oldState.board,
                    fleets: oldState.board.fleets.with(orbital, withMap2(withMap2(oFleets,
                      eventPlayer, f => f + 1),
                      players[eventPlayer].opposite, f => f - 1)),
                  },
                }))),
          },
        };

      } else {
        return {
          ...defaultContinuation,
          instructions: `${players[eventPlayer].name}, select a fleet to convert to a boarding party.`,
          actions: {
            ...defaultContinuation.actions,

            clickOrbital: oldState.board.fleets.map((oFleets, orbital) =>
              oFleets[eventPlayer] == 0
                ? nullopt
                : opt({
                  ...oldState,
                  phase: {
                    ...oldPhase,
                    removedOrbital: opt(orbital),
                  },
                  board: {
                    ...oldState.board,
                    fleets: oldState.board.fleets.with(orbital, withMap2(oFleets, eventPlayer, f => f - 1)),
                  },
                })),
          },
        };
      }
    }

    else if (oldPhase.focus === EventId.Ambush) {
      return {
        ...defaultContinuation,
        instructions: `${players[eventPlayer].name}, remove a fleet.`,
        actions: {
          ...defaultContinuation.actions,

          clickOrbital: oldState.board.fleets.map((oFleets, orbital) =>
            oFleets[players[eventPlayer].opposite] == 0
              ? nullopt
              : opt(endEvent({
                ...oldState,
                phase: oldPhase,
                board: {
                  ...oldState.board,
                  fleets: oldState.board.fleets.with(orbital, withMap2(oFleets, players[eventPlayer].opposite, f => f - 1)),
                },
              }))),
        },
      };
    }

    else if (oldPhase.focus === EventId.CaptainYvgeny) {
      return {
        ...defaultContinuation,
        instructions: `${players[eventPlayer].name}, remove a fleet where you have a fleet.`,
        actions: {
          ...defaultContinuation.actions,

          clickOrbital: oldState.board.fleets.map((oFleets, orbital) =>
            oFleets.some(f => f == 0)
              ? nullopt
              : opt(endEvent({
                ...oldState,
                phase: oldPhase,
                board: {
                  ...oldState.board,
                  fleets: oldState.board.fleets.with(orbital, withMap2(oFleets, players[eventPlayer].opposite, f => f - 1)),
                },
              }))),
        },
      };
    }

    else if (oldPhase.focus === EventId.StealthShips) {
      const oldSelectedFleet = oldPhase.selectedFleet;
      if (oldSelectedFleet.hasValue === false) {
        return {
          ...defaultContinuation,
          instructions: `${players[eventPlayer].name}, select a fleet to turn into a stealth ship.`,
          actions: {
            ...defaultContinuation.actions,

            clickOrbital: oldState.board.fleets.map((oFleets, orbital) =>
              oFleets[eventPlayer] == 0
                ? nullopt
                : opt({
                  ...oldState,
                  phase: {
                    ...oldPhase,
                    selectedFleet: opt(orbital),
                  },
                  board: {
                    ...oldState.board,
                    fleets: oldState.board.fleets.with(orbital, withMap2(oFleets, eventPlayer, f => f - 1)),
                  },
                })),
          },
        };

      } else {
        return {
          ...defaultContinuation,
          instructions: `${players[eventPlayer].name}, select fleet(s) to ambush.`,
          actions: {
            ...defaultContinuation.actions,

            clickFleet: defaultContinuation.actions.clickFleet.map((orbitalActions, orbital) =>
              (Math.abs((orbitals[oldSelectedFleet.value]?.band ?? 0) - (orbitals[orbital]?.band ?? 0)) > 1)
                ? orbitalActions
                : orbitalActions.with(players[eventPlayer].opposite,
                  Array(oldState.board.fleets[orbital]?.[players[eventPlayer].opposite]).fill(false).map((_, iFleet) =>
                    iFleet >= 2
                      ? nullopt
                      : opt(endEvent({
                        ...oldState,
                        phase: oldPhase,
                        board: {
                          ...oldState.board,
                          fleets: oldState.board.fleets.withMap(orbital, oFleets => withMap2(oFleets, players[eventPlayer].opposite, f => f - iFleet - 1)),
                        },
                      }))))),
          },
        };
      }
    }

    else if (
      oldPhase.focus === EventId.HeavyBurn
      || oldPhase.focus === EventId.AdmiralSouther
    ) {
      const selectedFleetGroup = oldPhase.selectedFleetGroup;
      if (selectedFleetGroup.hasValue === false) {
        return {
          ...defaultContinuation,
          instructions: `${players[eventPlayer].name}, you may move ${oldPhase.remaining} more fleets. Select fleets to move.`,
          actions: {
            ...defaultContinuation.actions,

            clickFleet: defaultContinuation.actions.clickFleet.map((oActions, orbital) =>
              oActions.with(eventPlayer, Array(oldState.board.fleets[orbital]?.[eventPlayer]).fill(false).map((_, iFleet) =>
                iFleet >= (oldPhase.fleetsPermitted[orbital] ?? 0)
                  ? nullopt
                  : opt({
                    ...oldState,
                    phase: {
                      ...oldState.phase,
                      selectedFleetGroup: opt({
                        orbital,
                        count: iFleet + 1,
                      }),
                      fleetsPermitted: oldPhase.fleetsPermitted.withMap(orbital, f => f - iFleet - 1),
                    },
                  })))),

            clickPass: opt(endEvent({
              ...oldState,
              phase: oldPhase,
            })),
          },
        };
      } else {
        return {
          ...defaultContinuation,
          instructions: `${players[eventPlayer].name}, you may move ${oldPhase.remaining} more fleet groups. Select a destination for your fleets.`,
          actions: {
            ...defaultContinuation.actions,

            clickOrbital: orbitals.map(orbital =>
              (Math.abs(orbital.band - (orbitals[selectedFleetGroup.value.orbital]?.band ?? 0)) > (oldPhase.focus === EventId.HeavyBurn ? 2 : 1))
                ? nullopt
                : opt((oldPhase.remaining === 1 ? endEvent : identity)({
                  ...oldState,
                  board: {
                    ...oldState.board,
                    fleets:
                      oldState.board.fleets
                        .withMap(
                          selectedFleetGroup.value.orbital,
                          oFleets => withMap2(oFleets, eventPlayer, f => f - selectedFleetGroup.value.count)
                        )
                        .withMap(
                          orbital.id,
                          oFleets => withMap2(oFleets, eventPlayer, f => f + selectedFleetGroup.value.count)
                        ),
                  },
                  phase: {
                    ...oldPhase,
                    remaining: oldPhase.remaining - 1,
                    selectedFleetGroup: nullopt,
                  },
                }))
            ),
          },
        };
      }
    }

    else if (oldPhase.focus === EventId.Razorback) {
      const selectedFleet = oldPhase.selectedFleet;
      if (selectedFleet.hasValue === false) {
        return {
          ...defaultContinuation,
          instructions: `${players[eventPlayer].name}, select fleet to move.`,
          actions: {
            ...defaultContinuation.actions,

            clickOrbital: oldState.board.fleets.map((oFleets, orbital) =>
              oFleets[eventPlayer] === 0
                ? nullopt
                : opt({
                  ...oldState,
                  phase: {
                    ...oldPhase,
                    selectedFleet: opt(orbital),
                  },
                })),
          },
        };
      } else {
        return {
          ...defaultContinuation,
          instructions: `${players[eventPlayer].name}, select a destination for your fleet.`,
          actions: {
            ...defaultContinuation.actions,

            clickOrbital: orbitals.map(orbital => opt(endEvent({
              ...oldState,
              phase: oldPhase,
              board: {
                ...oldState.board,
                fleets:
                  oldState.board.fleets
                    .withMap(
                      selectedFleet.value,
                      oFleets => withMap2(oFleets, eventPlayer, f => f - 1)
                    )
                    .withMap(
                      orbital.id,
                      oFleets => withMap2(oFleets, eventPlayer, f => f + 1)
                    ),
              },
            }))),
          },
        };
      }
    }
  }

  assertType<never>(oldPhase);
  return oldPhase;
}
