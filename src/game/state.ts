import { assertType, asType, clamp, identity, map2, map3, satisfiesCheck, with2, withMap2, withMap3 } from "../core/misc";
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
  | {
    phase: "ap turn initiative event",
    turn: PlayerId,
  }
  | {
    phase: "event turn event",
    turn: PlayerId,
    history: { source: "kept" | "track" | "miller" },
  }
  | {
    phase: "score turn kept event",
    turn: PlayerId,
    bonusSector: SectorId,
    action: PlayerId,
    history: { events: [Optional<EventId>, Optional<EventId>] },
  }
  ;
export type GameStatePhase =
  | (GameStatePhaseEventPhase & GameStateEventPhase)
  | {
    phase: "start",
    turn: PlayerId,
    focus: Optional<EventId>,
  }
  | {
    phase: "ap turn deciding mao-kwik",
    turn: PlayerId,
    focus: EventId,
  }
  | (
    & {
      phase: "ap turn ap",
      turn: PlayerId,
      focus: EventId,
    }
    & GameStateAPPhase
  )
  | {
    phase: "ap turn deciding miller",
    turn: PlayerId,
    focus: Exclude<EventId, EventIdKeepOnly>,
  }
  // ap turn miller event
  | {
    phase: "ap turn initiative deciding",
    turn: PlayerId,
    focus: EventId,
  }
  // ap turn initiative event
  // event turn event
  | {
    phase: "score turn deciding sector",
    turn: PlayerId,
  }
  | {
    phase: "score turn kept event deciding",
    turn: PlayerId,
    bonusSector: SectorId,
    action: PlayerId,
    history: { events: [Optional<EventId>, Optional<EventId>] },
  }
  // score turn kept event
  | { phase: "game over" }
  ;

export type GameState = {
  board: GameStateBoard,
  phase: GameStatePhase,
};

export type TurnHistoryItem =
  & { turn: PlayerId, card: Card }
  & (
    | {
      type: "play kept",
      card: Card & { type: CardType.Event },
    }
    | (
      //& { iTrack: number }
      & (
        | {
          type: "track ap",
          card: Card & { type: CardType.Event },
          eventUse: "self miller" | "initiative keep" | "initiative use" | "pass"
        }
        | {
          type: "track event" | "keep track",
          card: Card & { type: CardType.Event },
        }
        | {
          type: "score"
          card: Card & { type: CardType.Score },
          bonusSector: SectorId,
          events: [Optional<EventId>, Optional<EventId>],
        }
      )
    )
  );

export type GameStateContinuation = {
  state: GameState,
  turnsComplete: TurnHistoryItem[],
};
export type GameStateContinuations = {
  instructions: string,
  decision: Optional<{
    player: PlayerId,
    actions: {
      clickBase: Optional<GameStateContinuation>[],
      clickOrbital: Optional<GameStateContinuation>[],
      /// clickInfluence[base][player][amount_minus_1]
      clickInfluence: Optional<GameStateContinuation>[][][],
      /// clickFleet[orbital][player][amount_minus_1]
      clickFleet: Optional<GameStateContinuation>[][][],
      clickSector: Optional<GameStateContinuation>[],
      clickBuildFleet: Optional<GameStateContinuation>[],
      // clickKeptCard[player][iKept]
      clickKeptCard: Optional<GameStateContinuation>[][],
      clickTrackCard: Optional<GameStateContinuation>[],
      clickUseAP: Optional<GameStateContinuation>,
      clickUseEvent: Optional<GameStateContinuation>,
      clickKeepEvent: Optional<GameStateContinuation>,
      clickPass: Optional<GameStateContinuation>,
    },
  }>,
};
const defaultContinuationActions: (GameStateContinuations["decision"] & { hasValue: true })["value"]["actions"] = {
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
};


function drawContinuation(continuation: GameStateContinuation): GameStateContinuation {
  const card = continuation.state.board.deck[0];
  if (card === undefined) throw `unexpected empty deck`;

  if (continuation.state.board.deck.slice(1).some(c => c.type === CardType.Score) === false) {
    return scoreContinuation(
      nullopt,
      {
        ...continuation,
        state: {
          ...continuation.state,
          phase: { phase: "game over" },
          board: {
            ...continuation.state.board,
            cardTrack: continuation.state.board.cardTrack.concat({ type: CardType.Score }),
          },
        },
      });

  } else {
    return {
      ...continuation,
      state: {
        ...continuation.state,
        board: {
          ...continuation.state.board,
          cardTrack: continuation.state.board.cardTrack.concat(card),
          deck: continuation.state.board.deck.slice(1),
        },
      },
    };
  }
}

function reduceApContinuation(continuation: GameStateContinuation): GameStateContinuation {
  if (continuation.state.phase.phase === "ap turn ap") {
    if (continuation.state.phase.ap === 1) {
      if (
        continuation.state.board.kept[continuation.state.phase.turn].some(e => e == EventId.Miller)
        && events[continuation.state.phase.focus]?.factions[continuation.state.phase.turn]
        && continuation.state.phase.focus !== EventId.Miller
        && continuation.state.phase.focus !== EventId.MaoKwik
      ) {
        return {
          ...continuation,
          state: {
            ...continuation.state,
            phase: {
              ...continuation.state.phase,
              phase: "ap turn deciding miller",
              focus: continuation.state.phase.focus,
            },
          },
        };

      } else if (events[continuation.state.phase.focus]?.factions[players[continuation.state.phase.turn].opposite]) {
        return {
          ...continuation,
          state: {
            ...continuation.state,
            phase: {
              ...continuation.state.phase,
              phase: "ap turn initiative deciding",
            },
          },
        };

      } else {
        return drawContinuation({
          ...continuation,
          state: {
            ...continuation.state,
            phase: {
              ...continuation.state.phase,
              phase: "start",
              turn: players[continuation.state.phase.turn].opposite,
              focus: nullopt,
            },
          },
          turnsComplete: continuation.turnsComplete.concat({
            type: "track ap",
            turn: continuation.state.phase.turn,
            card: { type: CardType.Event, event: continuation.state.phase.focus },
            eventUse: "pass",
          } satisfies TurnHistoryItem),
        });
      }

    } else {
      return {
        ...continuation,
        state: {
          ...continuation.state,
          phase: {
            ...continuation.state.phase,
            ap: continuation.state.phase.ap - 1,
          },
        },
      };
    }

  } else if (
    (
      continuation.state.phase.phase === "ap turn initiative event"
      || continuation.state.phase.phase === "event turn event"
      || continuation.state.phase.phase === "score turn kept event"
    )
    && (
      continuation.state.phase.focus === EventId.Drummer
      || continuation.state.phase.focus === EventId.Cotyar
    )
  ) {
    if (continuation.state.phase.ap === 1) {
      return endEventContinuation({
        ...continuation,
        state: {
          ...continuation.state,
          phase: continuation.state.phase,
        },
      });

    } else {
      return {
        ...continuation,
        state: {
          ...continuation.state,
          phase: {
            ...continuation.state.phase,
            ap: continuation.state.phase.ap - 1,
          },
        },
      };
    }

  } else throw `can't reduce ap from this state`;
}

function scoreContinuation(bonusSector: Optional<SectorId>, continuation: GameStateContinuation): GameStateContinuation {
  const points = bases.map(base => {
    const fleets = continuation.state.board.fleets[base.orbital];
    const influence = continuation.state.board.influence[base.id];
    if (fleets === undefined || influence === undefined) throw `${continuation.state}`;

    const orbitalControlBonus = map2(players, p => fleets[p.id] > fleets[p.opposite] && influence[p.id] != 0 ? 1 : 0);
    const power = map2(orbitalControlBonus, (bonus, p) => influence[p] + bonus);
    return map2(players, (player): number =>
      (power[player.id] == 0)
        ? 0
        : (power[player.id] > power[players[player.id].opposite])
          ? 1 + (
            (bonusSector.hasValue && bands[orbitals[base.orbital]?.band ?? 0].sector == bonusSector.value)
              ? bonusSectorBonusPoints[6 - continuation.state.board.bonusSectorsRemaining.reduce((a, b) => a + b)]?.[0] ?? 0
              : 0
          )
          : (
            (bonusSector.hasValue && bands[orbitals[base.orbital]?.band ?? 0].sector == bonusSector.value)
              ? bonusSectorBonusPoints[6 - continuation.state.board.bonusSectorsRemaining.reduce((a, b) => a + b)]?.[1] ?? 0
              : 0
          )
    );
  }).reduce((a, b) => [a[0] + b[0], a[1] + b[1]]);

  return (bonusSector.hasValue ? drawContinuation : identity)({
    ...continuation,
    state: {
      ...continuation.state,
      board: {
        ...continuation.state.board,
        bonusSectorsRemaining:
          bonusSector.hasValue
            ? withMap3(continuation.state.board.bonusSectorsRemaining, bonusSector.value, r => r - 1)
            : continuation.state.board.bonusSectorsRemaining,
        cp: map2(continuation.state.board.cp, (cp, p) => cp + points[p]),
        fleets: players.reduce((fleets, player) =>
          fleets.withMap(player.homeOrbital, oFleets =>
            withMap2(oFleets, player.id, f =>
              f + ((continuation.state.board.fleets.map(o => o[player.id]).reduce((a, b) => a + b) < FLEET_COUNT) ? 1 : 0))),
          continuation.state.board.fleets),
      },
    },
  });
}

function endEventContinuation(continuation: GameStateContinuation & { state: GameState & { phase: GameStatePhaseEventPhase } }): GameStateContinuation {
  if (
    continuation.state.phase.phase === "ap turn initiative event"
    || continuation.state.phase.phase === "event turn event"
  ) {
    return ((continuation.state.board.cardTrack.length < TRACK_COUNT) ? drawContinuation : identity)({
      ...continuation,
      state: {
        ...continuation.state,
        phase: {
          ...continuation.state.phase,
          phase: "start",
          turn: players[continuation.state.phase.turn].opposite,
          focus: nullopt,
        },
      },
      turnsComplete: continuation.turnsComplete.concat([
        continuation.state.phase.phase === "ap turn initiative event"
          ? {
            type: "track ap",
            turn: continuation.state.phase.turn,
            card: { type: CardType.Event, event: continuation.state.phase.focus },
            eventUse: "initiative use",
          }
          : satisfiesCheck<"event turn event">(continuation.state.phase.phase)(
            continuation.state.phase.history.source === "kept"
              ? {
                type: "play kept",
                turn: continuation.state.phase.turn,
                card: { type: CardType.Event, event: continuation.state.phase.focus },
              }
              : continuation.state.phase.history.source === "track"
                ? {
                  type: "track event",
                  turn: continuation.state.phase.turn,
                  card: { type: CardType.Event, event: continuation.state.phase.focus },
                }
                : satisfiesCheck<"miller">(continuation.state.phase.history.source)({
                  type: "track ap",
                  turn: continuation.state.phase.turn,
                  card: { type: CardType.Event, event: continuation.state.phase.focus },
                  eventUse: "self miller",
                }))]),
    });

  } else {
    assertType<"score turn kept event">(continuation.state.phase.phase);

    if (
      continuation.state.phase.action != continuation.state.phase.turn
      && continuation.state.board.kept[continuation.state.phase.turn].some(k => k != EventId.Miller && k != EventId.MaoKwik)
    ) {
      return {
        ...continuation,
        state: {
          ...continuation.state,
          phase: {
            ...continuation.state.phase,
            phase: "score turn kept event deciding",
            action: continuation.state.phase.turn,
          },
        },
      };

    } else {
      return scoreContinuation(
        opt(continuation.state.phase.bonusSector),
        {
          ...continuation,
          state: {
            ...continuation.state,
            phase: {
              ...continuation.state.phase,
              phase: "start",
              turn: players[continuation.state.phase.turn].opposite,
              focus: nullopt,
            },
          },
          turnsComplete: continuation.turnsComplete.concat([{
            type: "score",
            turn: continuation.state.phase.turn,
            card: { type: CardType.Score },
            bonusSector: continuation.state.phase.bonusSector,
            events: continuation.state.phase.history.events,
          }]),
        });
    }
  }
}

function startEventContinuation(
  continuation: GameStateContinuation & { state: GameState & { phase: { phase: "start" | "ap turn deciding miller" | "ap turn initiative deciding" | "score turn kept event deciding" } } },
  newPhaseWithEventPhase: (eventPhase: GameStateEventPhase) => (GameStatePhase & GameStatePhaseEventPhase),
  event: Exclude<EventId, EventIdKeepOnly>
): GameStateContinuation {
  const immediatelyEndableEventPhase: GameStateEventPhase = { focus: EventId.Slingshot };

  const action =
    (
      continuation.state.phase.phase === "start"
      || continuation.state.phase.phase === "ap turn deciding miller"
    )
      ? continuation.state.phase.turn
      : continuation.state.phase.phase === "ap turn initiative deciding"
        ? players[continuation.state.phase.turn].opposite
        : continuation.state.phase.action;

  if (
    event === EventId.Drummer
    || event === EventId.Cotyar
  ) {
    return {
      ...continuation,
      state: {
        ...continuation.state,
        phase: newPhaseWithEventPhase({
          focus: event,
          ap: (event === EventId.Drummer) ? 1 : satisfiesCheck<EventId.Cotyar>(event)(2),
          selectedFleetGroup: nullopt,
        }),
      },
    };

  } else if (event === EventId.Assassin) {
    if (continuation.state.board.kept[action].length != 0) {
      return {
        ...continuation,
        state: {
          ...continuation.state,
          phase: newPhaseWithEventPhase({
            focus: event,
            assassinAction: action,
          }),
        },
      };

    } else if (continuation.state.board.kept[players[action].opposite].length != 0) {
      return {
        ...continuation,
        state: {
          ...continuation.state,
          phase: newPhaseWithEventPhase({
            focus: event,
            assassinAction: players[action].opposite,
          }),
        },
      };

    } else {
      return endEventContinuation({
        ...continuation,
        state: {
          ...continuation.state,
          phase: newPhaseWithEventPhase(immediatelyEndableEventPhase),
        },
      });
    }


  } else if (event === EventId.CovertOp) {
    return {
      ...continuation,
      state: {
        ...continuation.state,
        phase: newPhaseWithEventPhase({
          focus: event,
          selectedInfluence: nullopt,
        }),
      },
    };

  } else if (event === EventId.BushNaval) {
    return endEventContinuation({
      ...continuation,
      state: {
        ...continuation.state,
        phase: newPhaseWithEventPhase(immediatelyEndableEventPhase),
        board: {
          ...continuation.state.board,
          fleets: players.reduce(
            (newFleets, player) =>
              newFleets.withMap(
                player.homeOrbital, oFleets =>
                withMap2(oFleets, player.id, f =>
                  f + FLEET_COUNT - continuation.state.board.fleets.map(f => f[player.id]).reduce((a, b) => a + b))),
            continuation.state.board.fleets
          ),
          cp: withMap2(continuation.state.board.cp, action, cp =>
            cp
            + ((continuation.state.board.fleets.map(f => f[players[action].opposite]).reduce((a, b) => a + b) < FLEET_COUNT) ? 1 : 0)),
        },
      },
    });

  } else if (
    event === EventId.AntonyDresden
    || event === EventId.FranklinDeGraff
    || event === EventId.Terraforming
  ) {
    return endEventContinuation({
      ...continuation,
      state: {
        ...continuation.state,
        phase: newPhaseWithEventPhase(immediatelyEndableEventPhase),
        board: {
          ...continuation.state.board,
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
                continuation.state.board.influence)
        },
      },
    });

  } else if (event === EventId.VoicesEros) {
    return {
      ...continuation,
      state: {
        ...continuation.state,
        phase: newPhaseWithEventPhase({
          focus: event,
          placingSector: SectorId.Inner,
        }),
      },
    };

  } else if (event === EventId.DestructionDeimos) {
    return {
      ...continuation,
      state: {
        ...continuation.state,
        board: {
          ...continuation.state.board,
          influence: bases.filter(b => b.orbital === OrbitalId.Mars && (continuation.state.board.influence[b.id]?.reduce((a, b) => a + b) ?? 0) > 0).reduce(
            (influence, base) =>
              influence.withMap(base.id, bInfluence =>
                withMap2(
                  bInfluence,
                  bInfluence[players[action].opposite] > 0 ? players[action].opposite : action,
                  i => i - 1))
            , continuation.state.board.influence
          ),
        },
        phase: newPhaseWithEventPhase({
          focus: event,
        }),
      },
    };

  } else if (
    event === EventId.BlockadeEarth
    || event === EventId.BlockadeMars
  ) {
    return {
      ...continuation,
      state: {
        ...continuation.state,
        phase: newPhaseWithEventPhase({
          focus: event,
          placing: true,
        }),
      },
    };

  } else if (event === EventId.SadavirErrinwright) {
    return endEventContinuation({
      ...continuation,
      state: {
        ...continuation.state,
        phase: newPhaseWithEventPhase(immediatelyEndableEventPhase),
        board: {
          ...continuation.state.board,
          influence: continuation.state.board.influence.map(bInfluence =>
            map2(bInfluence, i => Math.min(i, 2))),
        },
      },
    });

  } else if (
    event === EventId.Slingshot
    || event === EventId.Nauvoo
    || event === EventId.TheresaYao
    || event === EventId.CaptainYvgeny
  ) {
    return {
      ...continuation,
      state: {
        ...continuation.state,
        phase: newPhaseWithEventPhase({ focus: event }),
      },
    };

  } else if (event === EventId.BlackOps) {
    return {
      ...continuation,
      state: {
        ...continuation.state,
        phase: newPhaseWithEventPhase({
          focus: event,
          remaining: 3,
          bandPermitted: bands.map(_ => true),
        }),
      },
    };

  } else if (event === EventId.JulieMao) {
    return {
      ...continuation,
      state: {
        ...continuation.state,
        phase: newPhaseWithEventPhase({
          focus: event,
          removedBase: nullopt,
        }),
      },
    };

  } else if (event === EventId.StarHelix) {
    return {
      ...continuation,
      state: {
        ...continuation.state,
        phase: newPhaseWithEventPhase({
          focus: event,
          remaining: 2,
        }),
      },
    };

  } else if (event === EventId.RiotGear) {
    return {
      ...continuation,
      state: {
        ...continuation.state,
        phase: newPhaseWithEventPhase({
          focus: event,
          removedBase: nullopt,
        }),
      },
    };

  } else if (event === EventId.TheHybrid) {
    return {
      ...continuation,
      state: {
        ...continuation.state,
        phase: newPhaseWithEventPhase({
          focus: event,
          selected: nullopt,
        }),
      },
    };

  } else if (event === EventId.BobbieDraper) {
    return {
      ...continuation,
      state: {
        ...continuation.state,
        phase: newPhaseWithEventPhase({
          focus: event,
          removedOrbital: nullopt,
        }),
      },
    };

  } else if (event === EventId.Ambush) {
    return {
      ...continuation,
      state: {
        ...continuation.state,
        phase: newPhaseWithEventPhase({
          focus: event,
          removed: nullopt,
        }),
      },
    };

  } else if (event === EventId.StealthShips) {
    return {
      ...continuation,
      state: {
        ...continuation.state,
        phase: newPhaseWithEventPhase({
          focus: event,
          selectedFleet: nullopt,
        }),
      },
    };

  } else if (event === EventId.HeavyBurn) {
    return {
      ...continuation,
      state: {
        ...continuation.state,
        phase: newPhaseWithEventPhase({
          focus: event,
          remaining: 2,
          fleetsPermitted: continuation.state.board.fleets.map(oFleets => oFleets[action]),
          selectedFleetGroup: nullopt,
        }),
      },
    };

  } else if (event === EventId.Razorback) {
    return {
      ...continuation,
      state: {
        ...continuation.state,
        phase: newPhaseWithEventPhase({
          focus: event,
          selectedFleet: nullopt,
        }),
      },
    };

  } else if (event === EventId.AdmiralSouther) {
    return {
      ...continuation,
      state: {
        ...continuation.state,
        phase: newPhaseWithEventPhase({
          focus: event,
          remaining: continuation.state.board.fleets.map(f => f[action]).reduce((a, b) => a + b),
          fleetsPermitted: continuation.state.board.fleets.map(f => f[action]),
          selectedFleetGroup: nullopt,
        }),
      },
    };

  }

  assertType<never>(event);
  return event;
}

function apContinuations(oldState: GameState & { phase: GameStateAPPhase }, action: PlayerId): GameStateContinuations {
  const selectedFleetGroup = oldState.phase.selectedFleetGroup;
  if (selectedFleetGroup.hasValue === false) {
    return {
      instructions: `${players[action].name}, you have ${oldState.phase.ap} AP remaining. Place influence, move fleets, or build a fleet.`,
      decision: opt({
        player: action,
        actions: {
          ...defaultContinuationActions,

          clickBase: bases.map(base =>
            oldState.board.fleets[orbitals[base.orbital]?.id ?? 0]?.[action] === 0
              ? nullopt
              : opt(reduceApContinuation({
                state: {
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
                },
                turnsComplete: [],
              })),
          ),

          clickFleet: defaultContinuationActions.clickFleet.map((oActions, orbital) =>
            oActions.with(action, Array(oldState.board.fleets[orbital]?.[action]).fill(false).map((_, iFleet) => opt({
              state: {
                ...oldState,
                phase: {
                  ...oldState.phase,
                  selectedFleetGroup: opt({
                    orbital,
                    count: iFleet + 1,
                  }),
                },
              },
              turnsComplete: [],
            })))),

          clickBuildFleet: defaultContinuationActions.clickBuildFleet.with(action,
            oldState.board.fleets.map(oFleets => oFleets[action]).reduce((a, b) => a + b) == FLEET_COUNT
              ? nullopt
              : opt(reduceApContinuation({
                state: {
                  ...oldState,
                  phase: oldState.phase,
                  board: {
                    ...oldState.board,
                    fleets: oldState.board.fleets.withMap(players[action].homeOrbital, oFleets => withMap2(oFleets, action, f => f + 1)),
                  },
                },
                turnsComplete: [],
              }))),

          clickPass: opt(reduceApContinuation({
            state: {
              ...oldState,
              phase: asType<typeof oldState.phase>()({  // idk why we need this but compiler says we do
                ...oldState.phase,
                ap: 1,
              }),
            },
            turnsComplete: [],
          })),
        },
      }),
    };
  }

  else {
    return {
      instructions: `${players[action].name}, you have ${oldState.phase.ap} AP remaining. Select a destination for your fleet.`,
      decision: opt({
        player: action,
        actions: {
          ...defaultContinuationActions,

          clickOrbital: orbitals.map(orbital =>
            (Math.abs(orbital.band - (orbitals[selectedFleetGroup.value.orbital]?.band ?? 0)) > 1)
              ? nullopt
              : opt(reduceApContinuation({
                state: {
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
                },
                turnsComplete: [],
              }))
          ),
        },
      }),
    };
  }
}

export function getContinuations(oldState: GameState): GameStateContinuations {
  const oldPhase = oldState.phase;
  if (oldPhase.phase === "game over") {
    return {
      instructions: "Game over!",
      decision: nullopt,
    };
  }

  else if (oldPhase.phase === "start") {
    if (oldPhase.focus.hasValue === false) {
      return {
        instructions: `${players[oldPhase.turn].name}, choose ${oldState.board.kept[oldPhase.turn].some(k => k != EventId.Miller && k != EventId.MaoKwik) ? "a kept card or " : ""}a track card.`,
        decision: opt({
          player: oldPhase.turn,
          actions: {
            ...defaultContinuationActions,

            clickTrackCard: oldState.board.cardTrack.map((card, iTrack) =>
              oldState.board.cp[oldPhase.turn] < (trackCost[iTrack] ?? 0)
                ? nullopt
                : opt({
                  state: {
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
                  },
                  turnsComplete: [],
                }),
            ),

            clickKeptCard: defaultContinuationActions.clickKeptCard.with(oldPhase.turn, oldState.board.kept[oldPhase.turn].map(kept =>
              (
                kept === EventId.Miller
                || kept === EventId.MaoKwik
              )
                ? nullopt
                : opt(startEventContinuation(
                  {
                    state: {
                      ...oldState,
                      phase: oldPhase,
                      board: {
                        ...oldState.board,
                        kept: withMap2(oldState.board.kept, oldPhase.turn, k => k.filter(k => k != kept)),
                      },
                    },
                    turnsComplete: [],
                  },
                  eventPhase => ({
                    ...oldPhase,
                    ...eventPhase,
                    phase: "event turn event",
                    history: { source: "kept" }
                  }),
                  kept
                )))),
          },
        }),
      };
    }

    else {
      const focus = oldPhase.focus;
      return {
        instructions: `${players[oldPhase.turn].name}, choose what to do with the card.`,
        decision: opt({
          player: oldPhase.turn,
          actions: {
            ...defaultContinuationActions,

            clickUseAP: opt(
              (oldState.board.kept[oldPhase.turn].some(k => k === EventId.MaoKwik))
                ? {
                  state: {
                    ...oldState,
                    phase: {
                      ...oldPhase,
                      phase: "ap turn deciding mao-kwik",
                      focus: oldPhase.focus.value,
                    },
                  },
                  turnsComplete: [],
                }
                : {
                  state: {
                    ...oldState,
                    phase: {
                      ...oldPhase,
                      phase: "ap turn ap",
                      focus: oldPhase.focus.value,
                      ap: events[oldPhase.focus.value]?.ap ?? 0,
                      selectedFleetGroup: nullopt,
                    },
                  },
                  turnsComplete: [],
                }),

            clickUseEvent: (
              (
                oldPhase.focus.value == EventId.Miller
                || oldPhase.focus.value == EventId.MaoKwik
                || events[oldPhase.focus.value]?.factions[oldPhase.turn] === false
              )
                ? nullopt
                : opt(startEventContinuation(
                  {
                    state: {
                      ...oldState,
                      phase: oldPhase,
                    },
                    turnsComplete: [],
                  },
                  eventPhase => ({
                    ...oldPhase,
                    ...eventPhase,
                    phase: "event turn event",
                    history: { source: "track" },
                  }),
                  oldPhase.focus.value
                ))),

            clickKeepEvent: (
              (
                oldState.board.cp[oldPhase.turn] < (events[oldPhase.focus.value]?.keepCost ?? 0)
                || events[oldPhase.focus.value]?.factions[oldPhase.turn] === false
              )
                ? nullopt
                : opt(drawContinuation({
                  state: {
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
                  },
                  turnsComplete: [{
                    type: "keep track",
                    turn: oldPhase.turn,
                    card: { type: CardType.Event, event: oldPhase.focus.value },
                  }],
                }))),
          },
        }),
      };
    }
  }

  else if (oldPhase.phase === "ap turn ap") {
    return apContinuations({ ...oldState, phase: oldPhase }, oldPhase.turn);
  }

  else if (oldPhase.phase === "ap turn deciding mao-kwik") {
    return {
      instructions: `${players[oldPhase.turn].name}, choose whether to use the card's AP, or 4 AP from kept ${events[EventId.MaoKwik]?.title}.`,
      decision: opt({
        player: oldPhase.turn,
        actions: {
          ...defaultContinuationActions,

          clickKeptCard: defaultContinuationActions.clickKeptCard.with(oldPhase.turn, oldState.board.kept[oldPhase.turn].map(kept =>
            kept !== EventId.MaoKwik
              ? nullopt
              : opt({
                state: {
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
                },
                turnsComplete: [],
              }))),

          clickUseAP: opt({
            state: {
              ...oldState,
              phase: {
                ...oldPhase,
                phase: "ap turn ap",
                focus: oldPhase.focus,
                ap: events[oldPhase.focus]?.ap ?? 0,
                selectedFleetGroup: nullopt,
              },
            },
            turnsComplete: [],
          }),
        },
      }),
    };
  }

  else if (oldPhase.phase === "ap turn deciding miller") {
    return {
      instructions: `${players[oldPhase.turn].name}, choose whether to pass initiative to the other player, or use kept ${events[EventId.Miller]?.title} to use the card's event.`,
      decision: opt({
        player: oldPhase.turn,
        actions: {
          ...defaultContinuationActions,

          clickKeptCard: defaultContinuationActions.clickKeptCard.with(oldPhase.turn, oldState.board.kept[oldPhase.turn].map(kept =>
            kept !== EventId.Miller
              ? nullopt
              : opt(startEventContinuation(
                {
                  state: {
                    ...oldState,
                    phase: oldPhase,
                    board: {
                      ...oldState.board,
                      kept: withMap2(oldState.board.kept, oldPhase.turn, filterKept => filterKept.filter(k => k != EventId.Miller)),
                    },
                  },
                  turnsComplete: [],
                },
                eventPhase => ({
                  ...oldPhase,
                  ...eventPhase,
                  phase: "event turn event",
                  history: { source: "miller" },
                }),
                oldPhase.focus
              )))),

          clickPass: opt(
            (events[oldPhase.focus]?.factions[players[oldPhase.turn].opposite])
              ? {
                state: {
                  ...oldState,
                  phase: {
                    ...oldPhase,
                    phase: "ap turn initiative deciding",
                  },
                },
                turnsComplete: [],
              }
              : drawContinuation({
                state: {
                  ...oldState,
                  phase: {
                    ...oldPhase,
                    phase: "start",
                    turn: players[oldPhase.turn].opposite,
                    focus: nullopt,
                  },
                },
                turnsComplete: [{
                  type: "track ap",
                  turn: oldPhase.turn,
                  card: { type: CardType.Event, event: oldPhase.focus },
                  eventUse: "pass",
                }],
              })),
        },
      }),
    };
  }

  else if (oldPhase.phase === "ap turn initiative deciding") {
    const oldAction = players[oldPhase.turn].opposite;
    return {
      instructions: `${players[oldAction].name}, choose what to do with the card's event.`,
      decision: opt({
        player: oldAction,
        actions: {
          ...defaultContinuationActions,

          clickUseEvent: (
            (
              oldPhase.focus === EventId.MaoKwik
              || oldPhase.focus === EventId.Miller
            )
              ? nullopt
              : opt(startEventContinuation(
                {
                  state: {
                    ...oldState,
                    phase: oldPhase,
                  },
                  turnsComplete: [],
                },
                eventPhase => ({
                  ...oldPhase,
                  ...eventPhase,
                  phase: "ap turn initiative event",
                }),
                oldPhase.focus
              ))),

          clickKeepEvent: opt(drawContinuation({
            state: {
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
            },
            turnsComplete: [{
              type: "track ap",
              turn: oldPhase.turn,
              card: { type: CardType.Event, event: oldPhase.focus },
              eventUse: "initiative keep",
            }],
          })),

          clickPass: opt(drawContinuation({
            state: {
              ...oldState,
              phase: {
                ...oldPhase,
                phase: "start",
                turn: oldAction,
                focus: nullopt,
              },
            },
            turnsComplete: [{
              type: "track ap",
              turn: oldPhase.turn,
              card: { type: CardType.Event, event: oldPhase.focus },
              eventUse: "pass",
            }],
          })),
        },
      }),
    };
  }

  else if (oldPhase.phase === "score turn deciding sector") {
    return {
      instructions: `${players[oldPhase.turn].name}, choose a sector to receive bonus scoring.`,
      decision: opt({
        player: oldPhase.turn,
        actions: {
          ...defaultContinuationActions,

          clickSector: map3(oldState.board.bonusSectorsRemaining, (remaining, sector) =>
            (remaining === 0)
              ? nullopt
              : opt(
                (oldState.board.kept[players[oldPhase.turn].opposite].some(k => k != EventId.Miller && k != EventId.MaoKwik))
                  ? {
                    state: {
                      ...oldState,
                      phase: {
                        ...oldPhase,
                        phase: "score turn kept event deciding",
                        bonusSector: sector,
                        action: players[oldPhase.turn].opposite,
                        history: { events: [nullopt, nullopt], },
                      },
                    },
                    turnsComplete: [],
                  } satisfies GameStateContinuation
                  : (oldState.board.kept[oldPhase.turn].some(k => k != EventId.Miller && k != EventId.MaoKwik))
                    ? {
                      state: {
                        ...oldState,
                        phase: {
                          ...oldPhase,
                          phase: "score turn kept event deciding",
                          bonusSector: sector,
                          action: oldPhase.turn,
                          history: { events: [nullopt, nullopt], },
                        },
                      },
                      turnsComplete: [],
                    } satisfies GameStateContinuation
                    : scoreContinuation(
                      opt(sector),
                      {
                        state: {
                          ...oldState,
                          phase: {
                            ...oldPhase,
                            phase: "start",
                            turn: players[oldPhase.turn].opposite,
                            focus: nullopt,
                          },
                        },
                        turnsComplete: [{
                          type: "score",
                          turn: oldPhase.turn,
                          card: { type: CardType.Score },
                          bonusSector: sector,
                          events: [nullopt, nullopt],
                        }],
                      }))),
        },
      }),
    };
  }

  else if (oldPhase.phase === "score turn kept event deciding") {
    return {
      instructions: `${players[oldPhase.action].name}, you may play a kept event before scoring.`,
      decision: opt({
        player: oldPhase.action,
        actions: {
          ...defaultContinuationActions,

          clickKeptCard: defaultContinuationActions.clickKeptCard.with(oldPhase.action, oldState.board.kept[oldPhase.action].map(kept =>
            (
              kept === EventId.MaoKwik
              || kept === EventId.Miller
            )
              ? nullopt
              : opt(startEventContinuation(
                {
                  state: {
                    ...oldState,
                    phase: oldPhase,
                    board: {
                      ...oldState.board,
                      kept: withMap2(oldState.board.kept, oldPhase.action, filterKept => filterKept.filter(k => k != kept)),
                    },
                  },
                  turnsComplete: [],
                },
                eventPhase => ({
                  ...oldPhase,
                  ...eventPhase,
                  phase: "score turn kept event",
                  history: {
                    ...oldPhase.history,
                    events: with2(oldPhase.history.events, oldPhase.action, opt(kept)),
                  },
                }),
                kept
              )))),

          clickPass: opt(
            (
              oldPhase.action != oldPhase.turn
              && oldState.board.kept[oldPhase.turn].some(k => k != EventId.Miller && k != EventId.MaoKwik)
            )
              ? {
                state: {
                  ...oldState,
                  phase: {
                    ...oldPhase,
                    action: oldPhase.turn,
                  },
                },
                turnsComplete: [],
              } satisfies GameStateContinuation
              : scoreContinuation(
                opt(oldPhase.bonusSector),
                {
                  state: {
                    ...oldState,
                    phase: {
                      ...oldPhase,
                      phase: "start",
                      turn: players[oldPhase.turn].opposite,
                      focus: nullopt,
                    },
                  },
                  turnsComplete: [{
                    type: "score",
                    turn: oldPhase.turn,
                    card: { type: CardType.Score },
                    bonusSector: oldPhase.bonusSector,
                    events: oldPhase.history.events,
                  }],
                })),
        },
      }),
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
      return apContinuations({ ...oldState, phase: oldPhase }, eventPlayer);
    }

    else if (oldPhase.focus === EventId.Assassin) {
      return {
        instructions: `${players[oldPhase.assassinAction].name}, choose a kept card to discard.`,
        decision: opt({
          player: oldPhase.assassinAction,
          actions: {
            ...defaultContinuationActions,

            clickKeptCard: defaultContinuationActions.clickKeptCard.with(oldPhase.assassinAction, oldState.board.kept[oldPhase.assassinAction].map(kept =>
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
                      : endEventContinuation
                  )({
                    state: {
                      ...oldState,
                      board: {
                        ...oldState.board,
                        kept: withMap2(oldState.board.kept, oldPhase.assassinAction, filterKept => filterKept.filter(k => k != kept))
                      },
                      phase: {
                        ...oldPhase,
                        assassinAction: players[oldPhase.assassinAction].opposite,
                      },
                    },
                    turnsComplete: [],
                  })))),
          },
        }),
      };
    }

    else if (oldPhase.focus === EventId.CovertOp) {
      const oldSelectedInfluence = oldPhase.selectedInfluence;
      return {
        instructions: `${players[eventPlayer].name}, choose two influence to swap positions.`,
        decision: opt({
          player: eventPlayer,
          actions: {
            ...defaultContinuationActions,

            clickInfluence: oldState.board.influence.map((bInfluence, base) => map2(bInfluence, (influence, player) =>
              Array(influence).fill(
                (
                  oldSelectedInfluence.hasValue === false
                )
                  ? opt({
                    state: {
                      ...oldState,
                      phase: {
                        ...oldPhase,
                        selectedInfluence: opt({ base, player }),
                      },
                    },
                    turnsComplete: [],
                  } satisfies GameStateContinuation)
                  : (oldSelectedInfluence.value.player === player)
                    ? nullopt
                    : opt(endEventContinuation({
                      state: {
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
                      },
                      turnsComplete: [],
                    }))))),
          },
        }),
      };
    }

    else if (oldPhase.focus === EventId.VoicesEros) {
      return {
        instructions: `${players[eventPlayer].name}, place an influence in ${sectors[oldPhase.placingSector].name}.`,
        decision: opt({
          player: eventPlayer,
          actions: {
            ...defaultContinuationActions,

            clickBase: bases.map(base =>
              (bands[orbitals[base.orbital]?.band ?? 0].sector != oldPhase.placingSector)
                ? nullopt
                : opt((oldPhase.placingSector == SectorId.Outer ? endEventContinuation : identity)({
                  state: {
                    ...oldState,
                    board: {
                      ...oldState.board,
                      influence: oldState.board.influence.withMap(base.id, bInfluence => withMap2(bInfluence, eventPlayer, i => i + 1)),
                    },
                    phase: {
                      ...oldPhase,
                      placingSector: oldPhase.placingSector + 1,
                    },
                  },
                  turnsComplete: [],
                }))),
          },
        }),
      };
    }

    else if (oldPhase.focus === EventId.DestructionDeimos) {
      return {
        instructions: `${players[eventPlayer].name}, place influence on an Earth base.`,
        decision: opt({
          player: eventPlayer,
          actions: {
            ...defaultContinuationActions,

            clickBase: bases.map(base =>
              (base.orbital !== OrbitalId.Earth)
                ? nullopt
                : opt(endEventContinuation({
                  state: {
                    ...oldState,
                    phase: oldPhase,
                    board: {
                      ...oldState.board,
                      influence: oldState.board.influence.withMap(base.id, bInfluence => withMap2(bInfluence, eventPlayer, i => i + 1)),
                    },
                  },
                  turnsComplete: [],
                }))),
          },
        }),
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
          instructions: `${players[eventPlayer].name}, place influence in ${orbitals[orbital]?.name}.`,
          decision: opt({
            player: eventPlayer,
            actions: {
              ...defaultContinuationActions,

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
                        : endEventContinuation
                    )({
                      state: {
                        ...oldState,
                        board: {
                          ...oldState.board,
                          influence: oldState.board.influence.withMap(base.id, bInfluence => withMap2(bInfluence, eventPlayer, i => i + 1)),
                        },
                        phase: {
                          ...oldPhase,
                          placing: false,
                        },
                      },
                      turnsComplete: [],
                    })
                  )),
            },
          }),
        };

      } else {
        return {
          instructions: `${players[players[eventPlayer].opposite].name}, remove an influence from ${orbitals[orbital]?.name}.`,
          decision: opt({
            player: players[eventPlayer].opposite,
            actions: {
              ...defaultContinuationActions,

              clickBase: bases.map(base =>
                (base.orbital !== orbital)
                  ? nullopt
                  : ((oldState.board.influence[base.id]?.reduce((a, b) => a + b) ?? 0) == 0)
                    ? nullopt
                    : opt(endEventContinuation({
                      state: {
                        ...oldState,
                        phase: oldPhase,
                        board: {
                          ...oldState.board,
                          influence: oldState.board.influence.withMap(base.id, bInfluence => withMap2(
                            bInfluence,
                            bInfluence[players[eventPlayer].opposite] > 0 ? players[eventPlayer].opposite : eventPlayer,
                            i => i - 1)),
                        },
                      },
                      turnsComplete: [],
                    }))),

              clickPass: opt(endEventContinuation({
                state: {
                  ...oldState,
                  phase: oldPhase,
                },
                turnsComplete: [],
              })),
            },
          }),
        };
      }
    }

    else if (oldPhase.focus === EventId.Slingshot) {
      return {
        instructions: `${players[eventPlayer].name}, remove an influence in ${sectors[SectorId.Outer].name}.`,
        decision: opt({
          player: eventPlayer,
          actions: {
            ...defaultContinuationActions,

            clickBase: bases.map(base =>
              (bands[orbitals[base.orbital]?.band ?? 0].sector !== SectorId.Outer)
                ? nullopt
                : opt(endEventContinuation({
                  state: {
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
                  },
                  turnsComplete: [],
                }))),
          },
        }),
      };
    }

    else if (oldPhase.focus === EventId.BlackOps) {
      return {
        instructions: `${players[eventPlayer].name}, you may remove ${oldPhase.remaining} more influence from ${bands.filter(band => oldPhase.bandPermitted[band.id]).map(band => band.name).join(" or ")}.`,
        decision: opt({
          player: eventPlayer,
          actions: {
            ...defaultContinuationActions,

            clickBase: bases.map(base =>
              (
                (oldPhase.bandPermitted[orbitals[base.orbital]?.band ?? 0] === false)
                || (oldState.board.influence[base.id]?.[players[eventPlayer].opposite] == 0)
              )
                ? nullopt
                : opt((oldPhase.remaining == 1 ? endEventContinuation : identity)({
                  state: {
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
                  },
                  turnsComplete: [],
                }))),

            clickPass: opt(endEventContinuation({
              state: {
                ...oldState,
                phase: oldPhase,
              },
              turnsComplete: [],
            })),
          },
        }),
      };
    }

    else if (oldPhase.focus === EventId.JulieMao) {
      return {
        instructions: `${players[eventPlayer].name}, remove influence from 2 bases with the same resource.`,
        decision: opt({
          player: eventPlayer,
          actions: {
            ...defaultContinuationActions,

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
                : opt((oldPhase.removedBase.hasValue ? endEventContinuation : identity)({
                  state: {
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
                  },
                  turnsComplete: [],
                }))),
          },
        }),
      };
    }

    else if (oldPhase.focus === EventId.StarHelix) {
      return {
        instructions: `${players[eventPlayer].name}, you may remove ${oldPhase.remaining} more influence where you have influence.`,
        decision: opt({
          player: eventPlayer,
          actions: {
            ...defaultContinuationActions,

            clickBase: bases.map(base =>
              (oldState.board.influence[base.id]?.some(i => i == 0))
                ? nullopt
                : opt((oldPhase.remaining == 1 ? endEventContinuation : identity)({
                  state: {
                    ...oldState,
                    phase: {
                      ...oldPhase,
                      remaining: oldPhase.remaining - 1,
                    },
                    board: {
                      ...oldState.board,
                      influence: oldState.board.influence.withMap(base.id, bInfluence => withMap2(bInfluence, players[eventPlayer].opposite, i => i - 1)),
                    },
                  },
                  turnsComplete: [],
                }))),

            clickPass: opt(endEventContinuation({
              state: {
                ...oldState,
                phase: oldPhase,
              },
              turnsComplete: [],
            })),
          },
        }),
      };
    }

    else if (oldPhase.focus === EventId.RiotGear) {
      return {
        instructions: `${players[eventPlayer].name}, you may remove ${oldPhase.removedBase.hasValue ? 1 : 2} more influence from ${sectors[SectorId.Belt].name}.`,
        decision: opt({
          player: eventPlayer,
          actions: {
            ...defaultContinuationActions,

            clickBase: bases.map(base =>
              (
                orbitals[base.orbital]?.band != BandId.Belt
                || oldState.board.influence[base.id]?.[players[eventPlayer].opposite] == 0
              )
                ? nullopt
                : opt((oldPhase.removedBase.hasValue ? endEventContinuation : identity)({
                  state: {
                    ...oldState,
                    phase: {
                      ...oldPhase,
                      removedBase: opt(base.id),
                    },
                    board: {
                      ...oldState.board,
                      influence: oldState.board.influence.withMap(base.id, bInfluence => withMap2(bInfluence, players[eventPlayer].opposite, i => i - 1)),
                    },
                  },
                  turnsComplete: [],
                }))),

            clickPass: opt(endEventContinuation({
              state: {
                ...oldState,
                phase: oldPhase,
              },
              turnsComplete: [],
            })),
          },
        }),
      };
    }

    else if (oldPhase.focus === EventId.TheHybrid) {
      const oldSelected = oldPhase.selected;
      if (oldSelected.hasValue === false) {
        const topCard = oldState.board.deck[0];
        if (topCard === undefined) throw `empty deck`;
        return {
          instructions: `${players[eventPlayer].name}, select a base to target.`,
          decision: opt({
            player: eventPlayer,
            actions: {
              ...defaultContinuationActions,

              clickBase:
                (
                  topCard.type === CardType.Event
                  && oldState.board.kept[eventPlayer].some(k => k === EventId.MaoKwik)
                )
                  ? bases.map(base => opt({
                    state: {
                      ...oldState,
                      phase: {
                        ...oldPhase,
                        selected: opt({
                          base: base.id,
                          topEvent: topCard.event,
                        }),
                      },
                    },
                    turnsComplete: [],
                  }))
                  : bases.map(base => opt(endEventContinuation({
                    state: {
                      ...oldState,
                      phase: oldPhase,
                      board: {
                        ...oldState.board,
                        influence: oldState.board.influence.withMap(base.id, bInfluence =>
                          withMap2(withMap2(bInfluence,
                            players[eventPlayer].opposite, i => topCard.type === CardType.Score ? 0 : Math.max(0, i - (events[topCard.event]?.ap ?? 0))),
                            eventPlayer, i => topCard.type === CardType.Score ? 0 : clamp(0, i, i - (events[topCard.event]?.ap ?? 0) + bInfluence[players[eventPlayer].opposite])))
                      },
                    },
                    turnsComplete: [],
                  }))),
            },
          }),
        };

      } else {
        return {
          instructions: `${players[eventPlayer].name}, decide whether to remove the card AP's influence, or use kept ${events[EventId.MaoKwik]?.title} to remove 4.`,
          decision: opt({
            player: eventPlayer,
            actions: {
              ...defaultContinuationActions,

              clickKeptCard: defaultContinuationActions.clickKeptCard.with(eventPlayer, oldState.board.kept[eventPlayer].map(kept =>
                kept != EventId.MaoKwik
                  ? nullopt
                  : opt(endEventContinuation({
                    state: {
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
                    },
                    turnsComplete: [],
                  })))),

              clickUseAP: opt(endEventContinuation({
                state: {
                  ...oldState,
                  phase: oldPhase,
                  board: {
                    ...oldState.board,
                    influence: oldState.board.influence.withMap(oldSelected.value.base, bInfluence =>
                      withMap2(withMap2(bInfluence,
                        players[eventPlayer].opposite, i => Math.max(0, i - (events[oldSelected.value.topEvent]?.ap ?? 0))),
                        eventPlayer, i => clamp(0, i, i - (events[oldSelected.value.topEvent]?.ap ?? 0) + bInfluence[players[eventPlayer].opposite])))
                  },
                },
                turnsComplete: [],
              })),
            },
          }),
        };
      }
    }

    else if (oldPhase.focus === EventId.Nauvoo) {
      return {
        instructions: `${players[eventPlayer].name}, remove an influence or fleet.`,
        decision: opt({
          player: eventPlayer,
          actions: {
            ...defaultContinuationActions,

            clickBase: oldState.board.influence.map((bInfluence, base) =>
              bInfluence[players[eventPlayer].opposite] == 0
                ? nullopt
                : opt(endEventContinuation({
                  state: {
                    ...oldState,
                    phase: oldPhase,
                    board: {
                      ...oldState.board,
                      influence: oldState.board.influence.with(base, withMap2(bInfluence, players[eventPlayer].opposite, i => i - 1)),
                    },
                  },
                  turnsComplete: [],
                }))),

            clickOrbital: oldState.board.fleets.map((oFleets, orbital) =>
              oFleets[players[eventPlayer].opposite] == 0
                ? nullopt
                : opt(endEventContinuation({
                  state: {
                    ...oldState,
                    phase: oldPhase,
                    board: {
                      ...oldState.board,
                      fleets: oldState.board.fleets.with(orbital, withMap2(oFleets, players[eventPlayer].opposite, i => i - 1)),
                    },
                  },
                  turnsComplete: [],
                }))),
          },
        }),
      };
    }

    else if (oldPhase.focus === EventId.TheresaYao) {
      return {
        instructions: `${players[eventPlayer].name}, select fleets to attack.`,
        decision: opt({
          player: eventPlayer,
          actions: {
            ...defaultContinuationActions,

            clickFleet: defaultContinuationActions.clickFleet.map((orbitalActions, orbital) => orbitalActions.with(players[eventPlayer].opposite,
              Array(oldState.board.fleets[orbital]?.[players[eventPlayer].opposite]).fill(false).map((_, iFleet) =>
                (iFleet >= (oldState.board.fleets[orbital]?.[eventPlayer] ?? 0))
                  ? nullopt
                  : opt(endEventContinuation({
                    state: {
                      ...oldState,
                      phase: oldPhase,
                      board: {
                        ...oldState.board,
                        fleets: oldState.board.fleets.withMap(orbital, oFleets =>
                          withMap2(withMap2(oFleets,
                            eventPlayer, f => f - iFleet),
                            players[eventPlayer].opposite, f => f - (iFleet + 1))),
                      },
                    },
                    turnsComplete: [],
                  }))))),

            clickPass: opt(endEventContinuation({
              state: {
                ...oldState,
                phase: oldPhase,
              },
              turnsComplete: [],
            })),
          },
        }),
      };
    }

    else if (oldPhase.focus === EventId.BobbieDraper) {
      if (
        oldState.board.fleets.map(oFleets => oFleets[eventPlayer]).reduce((a, b) => a + b) < FLEET_COUNT
        || oldPhase.removedOrbital.hasValue
      ) {
        return {
          instructions: `${players[eventPlayer].name}, select a fleet to board.`,
          decision: opt({
            player: eventPlayer,
            actions: {
              ...defaultContinuationActions,

              clickOrbital: oldState.board.fleets.map((oFleets, orbital) =>
                oFleets[players[eventPlayer].opposite] == 0
                  ? nullopt
                  : opt(endEventContinuation({
                    state: {
                      ...oldState,
                      phase: oldPhase,
                      board: {
                        ...oldState.board,
                        fleets: oldState.board.fleets.with(orbital, withMap2(withMap2(oFleets,
                          eventPlayer, f => f + 1),
                          players[eventPlayer].opposite, f => f - 1)),
                      },
                    },
                    turnsComplete: [],
                  }))),
            },
          }),
        };

      } else {
        return {
          instructions: `${players[eventPlayer].name}, select a fleet to convert to a boarding party.`,
          decision: opt({
            player: eventPlayer,
            actions: {
              ...defaultContinuationActions,

              clickOrbital: oldState.board.fleets.map((oFleets, orbital) =>
                oFleets[eventPlayer] == 0
                  ? nullopt
                  : opt({
                    state: {
                      ...oldState,
                      phase: {
                        ...oldPhase,
                        removedOrbital: opt(orbital),
                      },
                      board: {
                        ...oldState.board,
                        fleets: oldState.board.fleets.with(orbital, withMap2(oFleets, eventPlayer, f => f - 1)),
                      },
                    },
                    turnsComplete: [],
                  })),
            },
          }),
        };
      }
    }

    else if (oldPhase.focus === EventId.Ambush) {
      return {
        instructions: `${players[eventPlayer].name}, remove a fleet.`,
        decision: opt({
          player: eventPlayer,
          actions: {
            ...defaultContinuationActions,

            clickOrbital: oldState.board.fleets.map((oFleets, orbital) =>
              oFleets[players[eventPlayer].opposite] == 0
                ? nullopt
                : opt(endEventContinuation({
                  state: {
                    ...oldState,
                    phase: oldPhase,
                    board: {
                      ...oldState.board,
                      fleets: oldState.board.fleets.with(orbital, withMap2(oFleets, players[eventPlayer].opposite, f => f - 1)),
                    },
                  },
                  turnsComplete: [],
                }))),
          },
        }),
      };
    }

    else if (oldPhase.focus === EventId.CaptainYvgeny) {
      return {
        instructions: `${players[eventPlayer].name}, remove a fleet where you have a fleet.`,
        decision: opt({
          player: eventPlayer,
          actions: {
            ...defaultContinuationActions,

            clickOrbital: oldState.board.fleets.map((oFleets, orbital) =>
              oFleets.some(f => f == 0)
                ? nullopt
                : opt(endEventContinuation({
                  state: {
                    ...oldState,
                    phase: oldPhase,
                    board: {
                      ...oldState.board,
                      fleets: oldState.board.fleets.with(orbital, withMap2(oFleets, players[eventPlayer].opposite, f => f - 1)),
                    },
                  },
                  turnsComplete: [],
                }))),
          },
        }),
      };
    }

    else if (oldPhase.focus === EventId.StealthShips) {
      const oldSelectedFleet = oldPhase.selectedFleet;
      if (oldSelectedFleet.hasValue === false) {
        return {
          instructions: `${players[eventPlayer].name}, select a fleet to turn into a stealth ship.`,
          decision: opt({
            player: eventPlayer,
            actions: {
              ...defaultContinuationActions,

              clickOrbital: oldState.board.fleets.map((oFleets, orbital) =>
                oFleets[eventPlayer] == 0
                  ? nullopt
                  : opt({
                    state: {
                      ...oldState,
                      phase: {
                        ...oldPhase,
                        selectedFleet: opt(orbital),
                      },
                      board: {
                        ...oldState.board,
                        fleets: oldState.board.fleets.with(orbital, withMap2(oFleets, eventPlayer, f => f - 1)),
                      },
                    },
                    turnsComplete: [],
                  })),
            },
          }),
        };

      } else {
        return {
          instructions: `${players[eventPlayer].name}, select fleet(s) to ambush.`,
          decision: opt({
            player: eventPlayer,
            actions: {
              ...defaultContinuationActions,

              clickFleet: defaultContinuationActions.clickFleet.map((orbitalActions, orbital) =>
                (Math.abs((orbitals[oldSelectedFleet.value]?.band ?? 0) - (orbitals[orbital]?.band ?? 0)) > 1)
                  ? orbitalActions
                  : orbitalActions.with(players[eventPlayer].opposite,
                    Array(oldState.board.fleets[orbital]?.[players[eventPlayer].opposite]).fill(false).map((_, iFleet) =>
                      iFleet >= 2
                        ? nullopt
                        : opt(endEventContinuation({
                          state: {
                            ...oldState,
                            phase: oldPhase,
                            board: {
                              ...oldState.board,
                              fleets: oldState.board.fleets.withMap(orbital, oFleets => withMap2(oFleets, players[eventPlayer].opposite, f => f - iFleet - 1)),
                            },
                          },
                          turnsComplete: [],
                        }))))),
            },
          }),
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
          instructions: `${players[eventPlayer].name}, you may move ${oldPhase.remaining} more fleets. Select fleets to move.`,
          decision: opt({
            player: eventPlayer,
            actions: {
              ...defaultContinuationActions,

              clickFleet: defaultContinuationActions.clickFleet.map((oActions, orbital) =>
                oActions.with(eventPlayer, Array(oldState.board.fleets[orbital]?.[eventPlayer]).fill(false).map((_, iFleet) =>
                  iFleet >= (oldPhase.fleetsPermitted[orbital] ?? 0)
                    ? nullopt
                    : opt({
                      state: {
                        ...oldState,
                        phase: {
                          ...oldState.phase,
                          selectedFleetGroup: opt({
                            orbital,
                            count: iFleet + 1,
                          }),
                          fleetsPermitted: oldPhase.fleetsPermitted.withMap(orbital, f => f - iFleet - 1),
                        },
                      },
                      turnsComplete: [],
                    })))),

              clickPass: opt(endEventContinuation({
                state: {
                  ...oldState,
                  phase: oldPhase,
                },
                turnsComplete: [],
              })),
            },
          }),
        };
      } else {
        return {
          instructions: `${players[eventPlayer].name}, you may move ${oldPhase.remaining} more fleet groups. Select a destination for your fleets.`,
          decision: opt({
            player: eventPlayer,
            actions: {
              ...defaultContinuationActions,

              clickOrbital: orbitals.map(orbital =>
                (Math.abs(orbital.band - (orbitals[selectedFleetGroup.value.orbital]?.band ?? 0)) > (oldPhase.focus === EventId.HeavyBurn ? 2 : 1))
                  ? nullopt
                  : opt((oldPhase.remaining === 1 ? endEventContinuation : identity)({
                    state: {
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
                    },
                    turnsComplete: [],
                  }))
              ),
            },
          }),
        };
      }
    }

    else if (oldPhase.focus === EventId.Razorback) {
      const selectedFleet = oldPhase.selectedFleet;
      if (selectedFleet.hasValue === false) {
        return {
          instructions: `${players[eventPlayer].name}, select fleet to move.`,
          decision: opt({
            player: eventPlayer,
            actions: {
              ...defaultContinuationActions,

              clickOrbital: oldState.board.fleets.map((oFleets, orbital) =>
                oFleets[eventPlayer] === 0
                  ? nullopt
                  : opt({
                    state: {
                      ...oldState,
                      phase: {
                        ...oldPhase,
                        selectedFleet: opt(orbital),
                      },
                    },
                    turnsComplete: [],
                  })),
            },
          }),
        };
      } else {
        return {
          instructions: `${players[eventPlayer].name}, select a destination for your fleet.`,
          decision: opt({
            player: eventPlayer,
            actions: {
              ...defaultContinuationActions,

              clickOrbital: orbitals.map(orbital => opt(endEventContinuation({
                state: {
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
                },
                turnsComplete: [],
              }))),
            },
          }),
        };
      }
    }
  }

  assertType<never>(oldPhase);
  return oldPhase;
}
