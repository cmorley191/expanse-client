import "../core/array_extensions";

import * as React from "react";
import { motion, Transition } from "motion/react";

import { BandId, bands, BaseId, bases, bonusSectorBonusPoints, Card, CardType, EventId, EventIdKeepOnly, events, FLEET_COUNT, GameState, GameStateAPPhase, GameStateEventPhase, GameStatePhase, GameStatePhaseEventPhase, NONSCORES_PER_PILE, OrbitalId, orbitals, PILES, PlayerId, players, ResourceId, resources, SCORES_PER_PILE, SectorId, sectors, TRACK_COUNT, trackCost } from "../game/game_types";
import { assertType, getRandomInt, lerp, map2, satisfiesCheck, with2, withMap2, withMap3 } from "../core/misc";
import { nullopt, opt, Optional, optMap } from "../core/optional";


type AppProps = {};

type History =
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

export default function App({ }: AppProps) {
  const [gameState, setGameState] = React.useState<GameState>(() => {
    let deck =
      Array(events.length).fill(false)
        .map((_, i): Card => ({ type: CardType.Event, event: i as EventId }))
        .shuffled();
    const track = deck.slice(0, TRACK_COUNT);
    deck =
      deck
        .slice(TRACK_COUNT)
        .groupwise(NONSCORES_PER_PILE)
        .map((pile, iPile) =>
          iPile >= PILES
            ? pile
            : pile
              .concat(Array(SCORES_PER_PILE).fill(false).map((): Card => ({ type: CardType.Score })))
              .shuffled()
        )
        .flat();

    return {
      phase: {
        phase: "start",
        turn: getRandomInt(players.length) as PlayerId,
        focus: nullopt,
      },
      board: {
        cp: [10, 10],
        fleets: [
          [0, 2], // Earth
          [2, 0], // Mars
          [1, 1], // Ceres
          [0, 1], // Tycho
          [0, 0], // Eros
          [0, 0], // Thoth
          [1, 1], // Jupiter
          [1, 0], // Saturn
        ],
        influence: [
          [0, 1], // Eurasia
          [0, 1], // Africa
          [1, 0], // MarinerValley
          [1, 0], // LondresNova
          [0, 0], // Ceres
          [0, 0], // Tycho
          [0, 0], // Eros
          [0, 0], // Thoth
          [1, 0], // Europa
          [0, 0], // Ganymede
          [0, 1], // Rhea
          [0, 0], // Titan
        ],
        cardTrack: track,
        deck,
        kept: [[], []],
        bonusSectorsRemaining: [2, 2, 2],
      },
    };
  });

  const [history, setHistory] = React.useState<History[]>([]);
  const [completedHistoryLength, setCompletedHistoryLength] = React.useState(0);

  const phaseInstructions = ((): string => {
    if (gameState.phase.phase === "game over") return "Game over!";


    if (gameState.phase.phase === "start") {
      if (gameState.phase.focus.hasValue) return `${players[gameState.phase.turn]?.name}, choose what to do with the selected card.`;
      else return `${players[gameState.phase.turn]?.name}, choose ${gameState.board.kept[gameState.phase.turn].length != 0 ? "a kept card or " : ""}a track card.`;
    }
    // mao-kwik
    // ap later
    if (gameState.phase.phase === "ap turn deciding miller") return `${players[gameState.phase.turn]?.name}, choose whether to use kept Miller to use the card's event.`;
    if (gameState.phase.phase === "ap turn initiative deciding") return `${players[players[gameState.phase.turn]?.opposite ?? 0]?.name}, choose what to do with the other player's event card.`;
    // events later
    if (gameState.phase.phase === "score turn deciding sector") return `${players[gameState.phase.turn]?.name}, choose a sector to receive bonus scoring.`;
    if (gameState.phase.phase === "score turn kept event deciding") return `${players[gameState.phase.action]?.name}, you may use a kept event before the bonus sector is revealed, if you wish.`;

    const phase: (
      | {
        phase: "mao-kwik of some kind",
        action: PlayerId,
      }
      | {
        phase: "ap of some kind",
        apPhase: GameStateAPPhase,
        action: PlayerId,
      }
      | {
        phase:
        | "ap turn initiative event"
        | "event turn event"
        | "score turn kept event",
        eventPhase: GameStatePhaseEventPhase & GameStateEventPhase,
        action: PlayerId,
      }
    ) = (() => {
      if (gameState.phase.phase === "ap turn deciding mao-kwik") return {
        phase: "mao-kwik of some kind",
        action: gameState.phase.turn,
      };

      if (gameState.phase.phase === "ap turn ap") return {
        phase: "ap of some kind",
        apPhase: gameState.phase,
        action: gameState.phase.turn,
      };

      assertType<
        | "ap turn initiative event"
        | "event turn event"
        | "score turn kept event"
      >(gameState.phase.phase);

      const action =
        gameState.phase.phase === "ap turn initiative event"
          ? players[gameState.phase.turn].opposite
          : gameState.phase.phase === "event turn event"
            ? gameState.phase.turn
            : gameState.phase.action;

      if (
        gameState.phase.focus === EventId.Drummer
        || gameState.phase.focus === EventId.Cotyar
      ) return {
        phase: "ap of some kind",
        apPhase: gameState.phase,
        action,
      };

      if (
        gameState.phase.focus === EventId.TheHybrid
        && gameState.phase.selected.hasValue
      ) return {
        phase: "mao-kwik of some kind",
        action,
      };

      if (
        gameState.phase.focus === EventId.Assassin
      ) return {
        phase: gameState.phase.phase,
        eventPhase: gameState.phase,
        action: gameState.phase.assassinAction,
      };

      return {
        phase: gameState.phase.phase,
        eventPhase: gameState.phase,
        action,
      };
    })();

    if (phase.phase === "mao-kwik of some kind") {
      return `${players[phase.action]?.name}, choose whether to use the card's AP, or 4 AP from kept Mao-Kwikowski Mercantile.`;
    }

    if (phase.phase === "ap of some kind") {
      return `${players[phase.action]?.name}, you have ${phase.apPhase.ap} AP remaining. ` + (() => {
        if (phase.apPhase.selectedFleetGroup.hasValue) return "Select a destination for the selected fleets.";
        else return "Build a fleet, place an influence, or select a group of your fleets to move.";
      })();
    }

    const eventPhase = phase.eventPhase;
    if (
      eventPhase.focus === EventId.Drummer
      || eventPhase.focus === EventId.Cotyar
    ) throw `should've been handled above`;

    if (eventPhase.focus === EventId.Assassin) return `${players[eventPhase.assassinAction]?.name}, select a kept card to discard.`;
    if (eventPhase.focus === EventId.CovertOp) return `${players[phase.action]?.name}, select ${eventPhase.selectedInfluence.hasValue ? "another" : "an"} influence to swap.`;
    if (eventPhase.focus === EventId.VoicesEros) return `${players[phase.action]?.name}, place influence in ${sectors[eventPhase.placingSector]?.name}.`;
    if (eventPhase.focus === EventId.DestructionDeimos) return `${players[phase.action]?.name}, place influence in an Earth base.`;
    if (
      eventPhase.focus === EventId.BlockadeEarth
      || eventPhase.focus === EventId.BlockadeMars
    ) {
      const orbitalName = eventPhase.focus === EventId.BlockadeEarth ? "Earth" : "Mars";
      if (eventPhase.placing) return `${players[phase.action]?.name}, place an influence on ${orbitalName}.`;
      else return `${players[phase.action]?.name}, remove influence from ${orbitalName}.`;
    }
    if (eventPhase.focus === EventId.Slingshot) return `${players[phase.action]?.name}, remove influence from the Outer Planets.`;
    if (eventPhase.focus === EventId.BlackOps) return `${players[phase.action]?.name}, remove up to ${eventPhase.remaining} more influence from ${bands.filter(b => eventPhase.bandPermitted[b.id] ?? false).map(b => b.name).join(" or ")}.`;
    if (eventPhase.focus === EventId.JulieMao) {
      if (eventPhase.removedBase.hasValue) return `${players[phase.action]?.name}, remove an influence from another ${resources[bases[eventPhase.removedBase.value]?.resource ?? 0]?.name} base.`;
      else return `${players[phase.action]?.name}, remove an influence.`;
    }
    if (eventPhase.focus === EventId.StarHelix) return `${players[phase.action]?.name}, remove ${eventPhase.remaining} more influence where you have influence.`;
    if (eventPhase.focus === EventId.RiotGear) return `${players[phase.action]?.name}, you may remove influence from ${bases.filter(b => orbitals[b.orbital]?.band == BandId.Belt && (!eventPhase.removedBase.hasValue || b.id != eventPhase.removedBase.value)).map(b => b.name).join(" or ")}.`;
    if (eventPhase.focus === EventId.TheHybrid) {
      if (eventPhase.selected.hasValue) throw `mao-kwik -- should've been handled above`;
      else return `${players[phase.action]?.name}, select a base to target with The Hybrid.`;
    }
    if (eventPhase.focus === EventId.Nauvoo) return `${players[phase.action]?.name}, select a fleet or influence to remove.`;
    if (eventPhase.focus === EventId.TheresaYao) return `${players[phase.action]?.name}, select fleets to fight.`;
    if (eventPhase.focus === EventId.BobbieDraper) {
      if (eventPhase.removedOrbital.hasValue) return `${players[phase.action]?.name}, select a fleet to replace the removed fleet.`;
      else return `${players[phase.action]?.name}, select a fleet to board.`;
    }
    if (eventPhase.focus === EventId.Ambush) {
      if (eventPhase.removed.hasValue) return `${players[phase.action]?.name}, you may optionally also remove a ${players[players[eventPhase.removed.value.player]?.opposite ?? 0]?.name} fleet from ${orbitals[eventPhase.removed.value.orbital]?.name}.`;
      else return `${players[phase.action]?.name}, you may remove a fleet.`;
    }
    if (eventPhase.focus === EventId.CaptainYvgeny) return `${players[phase.action]?.name}, destroy one fleet.`;
    if (eventPhase.focus === EventId.StealthShips) {
      if (eventPhase.selectedFleet.hasValue) return `${players[phase.action]?.name}, select fleet(s) to attack.`;
      else return `${players[phase.action]?.name}, select a fleet to become a stealth attacker.`;
    }
    if (eventPhase.focus === EventId.HeavyBurn) {
      if (eventPhase.selectedFleetGroup.hasValue) return `${players[phase.action]?.name}, select a destination for the selected fleets.`;
      else return `${players[phase.action]?.name}, select a group of your fleets to move.`;
    }
    if (eventPhase.focus === EventId.Razorback) {
      if (eventPhase.selectedFleet.hasValue) return `${players[phase.action]?.name}, select a destination for the selected fleet.`;
      else return `${players[phase.action]?.name}, select a fleet to move.`;
    }
    assertType<EventId.AdmiralSouther>(eventPhase.focus);
    if (eventPhase.selectedFleetGroup.hasValue) return `${players[phase.action]?.name}, select a destination for the selected fleets.`;
    else return `${players[phase.action]?.name}, you may move ${eventPhase.remaining} more un-moved fleets.`;
  })();

  const eventCardDivs = events.map(event =>
    <div style={{ position: "relative", textAlign: "center", padding: "0.1dvw" }}>
      <div style={{ fontSize: "1.8cqw" }}>{event.ap} AP</div>
      <div style={{
        position: "absolute",
        top: "0.1dvw",
        right: "0.1dvw",
        fontSize: "0.8cqw"
      }}>
        ({event.id})
      </div>
      <div style={{
        border:
          (event.factions.filter(x => x).length != 1)
            ? "0.2dvw dashed magenta"
            : (event.factions[0])
              ? "0.2dvw dashed red"
              : "0.2dvw dashed blue",
      }}>
        <div style={{ display: "inline-flex", alignItems: "center" }}>
          <span style={{ fontSize: "0.7cqw" }}>
            {event.factions[PlayerId.MCR] ? "🎴" : ""}
            {event.factions[PlayerId.UN] ? "🌐" : ""}
            &nbsp;
          </span>
          <span style={{ fontSize: "1.0cqw" }}>{event.title}</span>
        </div>
        <div style={{ fontSize: "0.8cqw" }}>{event.shortText}</div>
      </div>
    </div>
  );

  const eventCardKeptDivs = events.map(event =>
    <div style={{ position: "relative", textAlign: "center", padding: "0.1dvw" }}>
      <div style={{
        position: "absolute",
        top: "0.1dvw",
        right: "0.1dvw",
        fontSize: "0.8cqw"
      }}>
        ({event.id})
      </div>
      <div style={{
        border:
          (event.factions.filter(x => x).length != 1)
            ? "0.2dvw dashed magenta"
            : (event.factions[0])
              ? "0.2dvw dashed red"
              : "0.2dvw dashed blue",
      }}>
        <div style={{ display: "inline-flex", alignItems: "center" }}>
          <span style={{ fontSize: "0.7cqw" }}>
            {event.factions[PlayerId.MCR] ? "🎴" : ""}
            {event.factions[PlayerId.UN] ? "🌐" : ""}
            &nbsp;
          </span>
          <span style={{ fontSize: "1.0cqw" }}>{event.title}</span>
        </div>
        <div style={{ fontSize: "0.8cqw" }}>{event.shortText}</div>
      </div>
    </div>
  );

  function drawAndSetGameState(newState: GameState) {
    const card = newState.board.deck[0]
    if (card === undefined) throw `unexpected empty deck`;

    if (newState.board.deck.slice(1).some(c => c.type === CardType.Score) === false) {
      scoreAndSetGameState(nullopt, {
        ...newState,
        phase: { phase: "game over" },
        board: {
          ...newState.board,
          cardTrack: newState.board.cardTrack.concat([{ type: CardType.Score }]),
        },
      });
    } else {
      setGameState({
        ...newState,
        board: {
          ...newState.board,
          cardTrack: newState.board.cardTrack.concat(card),
          deck: newState.board.deck.slice(1),
        },
      });
    }
  }

  function reduceApAndSetGameState(newState: GameState) {
    if (newState.phase.phase === "ap turn ap") {
      if (newState.phase.ap === 1) {
        if (
          newState.board.kept[newState.phase.turn].some(e => e == EventId.Miller)
          && events[newState.phase.focus]?.factions[newState.phase.turn]
        ) {
          setGameState({
            ...newState,
            phase: {
              ...newState.phase,
              phase: "ap turn deciding miller",
            },
          });
        } else if (events[newState.phase.focus]?.factions[players[newState.phase.turn].opposite]) {
          setGameState({
            ...newState,
            phase: {
              ...newState.phase,
              phase: "ap turn initiative deciding",
            },
          });
        } else {
          setHistory(history.concat([{
            type: "track ap",
            turn: newState.phase.turn,
            card: { type: CardType.Event, event: newState.phase.focus },
            eventUse: "pass",
          }]));
          setCompletedHistoryLength(completedHistoryLength + 1);

          drawAndSetGameState({
            ...newState,
            phase: {
              ...newState.phase,
              phase: "start",
              turn: players[newState.phase.turn].opposite,
              focus: nullopt,
            },
          });
        }
      } else {
        setGameState({
          ...newState,
          phase: {
            ...newState.phase,
            ap: newState.phase.ap - 1,
          },
        });
      }
    } else if (
      (
        newState.phase.phase === "ap turn initiative event"
        || newState.phase.phase === "event turn event"
        || newState.phase.phase === "score turn kept event"
      )
      && (
        newState.phase.focus === EventId.Drummer
        || newState.phase.focus === EventId.Cotyar
      )
    ) {
      if (newState.phase.ap === 1) {
        endEventAndSetGameState({
          ...newState,
          phase: newState.phase, // typescript sure is silly sometimes aint it
        });
      } else {
        setGameState({
          ...newState,
          phase: {
            ...newState.phase,
            ap: newState.phase.ap - 1,
          },
        });
      }
    } else {
      throw `unexpected call to reduceApAndSetGameState`;
    }
  }

  function scoreAndSetGameState(bonusSector: Optional<SectorId>, newState: GameState) {
    const points = bases.map(base => {
      const fleets = newState.board.fleets[base.orbital];
      const influence = newState.board.influence[base.id];
      if (fleets === undefined || influence === undefined) throw `${newState}`;

      const orbitalControlBonus = map2(players, p => fleets[p.id] > fleets[p.opposite] && influence[p.id] != 0 ? 1 : 0);
      const power = map2(orbitalControlBonus, (bonus, p) => influence[p] + bonus);
      return map2(players, (player): number =>
        (power[player.id] == 0)
          ? 0
          : (power[player.id] > power[players[player.id].opposite])
            ? 1 + (
              (bonusSector.hasValue && bands[orbitals[base.orbital]?.band ?? 0].sector == bonusSector.value)
                ? bonusSectorBonusPoints[6 - gameState.board.bonusSectorsRemaining.reduce((a, b) => a + b)]?.[0] ?? 0
                : 0
            )
            : (
              (bonusSector.hasValue && bands[orbitals[base.orbital]?.band ?? 0].sector == bonusSector.value)
                ? bonusSectorBonusPoints[6 - gameState.board.bonusSectorsRemaining.reduce((a, b) => a + b)]?.[1] ?? 0
                : 0
            )
      );
    }).reduce((a, b) => [a[0] + b[0], a[1] + b[1]]);

    setCompletedHistoryLength(completedHistoryLength + 1);
    (bonusSector.hasValue ? drawAndSetGameState : setGameState)({
      ...newState,
      board: {
        ...newState.board,
        cp: map2(newState.board.cp, (cp, p) => cp + points[p]),
        fleets: players.reduce((fleets, player) =>
          fleets.withMap(player.homeOrbital, oFleets =>
            withMap2(oFleets, player.id, f =>
              f + ((newState.board.fleets.map(o => o[player.id]).reduce((a, b) => a + b) < FLEET_COUNT) ? 1 : 0))),
          newState.board.fleets),
      },
    });
  }

  function endEventAndSetGameState(newState: GameState & { phase: GameStatePhaseEventPhase }) {
    if (newState.board.cardTrack.length === TRACK_COUNT) {
      // kept event
      setHistory(history.concat([{
        type: "play kept",
        turn: newState.phase.turn,
        card: {
          type: CardType.Event,
          event: newState.phase.focus,
        },
      }]));
    }

    if (
      newState.phase.phase === "ap turn initiative event"
      || newState.phase.phase === "event turn event"
    ) {
      setCompletedHistoryLength(completedHistoryLength + 1);
      ((newState.board.cardTrack.length < TRACK_COUNT) ? drawAndSetGameState : setGameState)({
        ...newState,
        phase: {
          ...newState.phase,
          phase: "start",
          turn: players[newState.phase.turn].opposite,
          focus: nullopt,
        },
      });

    } else {
      assertType<"score turn kept event">(newState.phase.phase);
      if (
        newState.phase.action != newState.phase.turn
        && newState.board.kept[newState.phase.turn].length > 0
      ) {
        setGameState({
          ...newState,
          phase: {
            ...newState.phase,
            action: newState.phase.turn,
          },
        });
      } else {
        scoreAndSetGameState(opt(newState.phase.bonusSector), {
          ...newState,
          phase: {
            ...newState.phase,
            phase: "start",
            turn: players[newState.phase.turn].opposite,
            focus: nullopt,
          },
        });
      }
    }
  }

  function startEventAndSetGameState(
    newState: GameState & { phase: { phase: "start" | "ap turn deciding miller" | "ap turn initiative deciding" | "score turn kept event deciding" } },
    newPhaseWithEventPhase: (eventPhase: GameStateEventPhase) => (GameStatePhase & GameStatePhaseEventPhase),
    event: Exclude<EventId, EventIdKeepOnly>
  ) {
    const immediatelyEndableEventPhase: GameStateEventPhase = { focus: EventId.Slingshot };

    const action =
      (
        newState.phase.phase === "start"
        || newState.phase.phase === "ap turn deciding miller"
      )
        ? newState.phase.turn
        : newState.phase.phase === "ap turn initiative deciding"
          ? players[newState.phase.turn].opposite
          : newState.phase.action;

    if (
      event === EventId.Drummer
      || event === EventId.Cotyar
    ) {
      setGameState({
        ...newState,
        phase: newPhaseWithEventPhase({
          focus: event,
          ap: (event === EventId.Drummer) ? 1 : satisfiesCheck<EventId.Cotyar>(event)(2),
          selectedFleetGroup: nullopt,
        }),
      });

    } else if (event === EventId.Assassin) {
      setGameState({
        ...newState,
        phase: newPhaseWithEventPhase({
          focus: event,
          assassinAction: action,
        }),
      });

    } else if (event === EventId.CovertOp) {
      setGameState({
        ...newState,
        phase: newPhaseWithEventPhase({
          focus: event,
          selectedInfluence: nullopt,
        }),
      });

    } else if (event === EventId.BushNaval) {
      endEventAndSetGameState({
        ...newState,
        phase: newPhaseWithEventPhase(immediatelyEndableEventPhase),
        board: {
          ...newState.board,
          fleets: players.reduce(
            (newFleets, player) =>
              newFleets.withMap(
                player.homeOrbital, oFleets =>
                withMap2(oFleets, player.id, f =>
                  f + FLEET_COUNT - newState.board.fleets.map(f => f[player.id]).reduce((a, b) => a + b))),
            newState.board.fleets
          ),
          cp: withMap2(newState.board.cp, action, cp => cp + ((newState.board.fleets.map(f => f[players[action].opposite]).reduce((a, b) => a + b) < FLEET_COUNT) ? 1 : 0)),
        },
      });

    } else if (
      event === EventId.AntonyDresden
      || event === EventId.FranklinDeGraff
      || event === EventId.Terraforming
    ) {
      endEventAndSetGameState({
        ...newState,
        phase: newPhaseWithEventPhase(immediatelyEndableEventPhase),
        board: {
          ...newState.board,
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
                newState.board.influence)
        },
      });

    } else if (event === EventId.VoicesEros) {
      setGameState({
        ...newState,
        phase: newPhaseWithEventPhase({
          focus: event,
          placingSector: SectorId.Inner,
        }),
      });

    } else if (event === EventId.DestructionDeimos) {
      setGameState({
        ...newState,
        board: {
          ...newState.board,
          influence: bases.filter(b => b.orbital === OrbitalId.Mars && (newState.board.influence[b.id]?.reduce((a, b) => a + b) ?? 0) > 0).reduce(
            (influence, base) =>
              influence.withMap(base.id, bInfluence =>
                withMap2(
                  bInfluence,
                  bInfluence[players[action].opposite] > 0 ? players[action].opposite : action,
                  i => i - 1))
            , newState.board.influence
          ),
        },
        phase: newPhaseWithEventPhase({
          focus: event,
        }),
      });

    } else if (
      event === EventId.BlockadeEarth
      || event === EventId.BlockadeMars
    ) {
      setGameState({
        ...newState,
        phase: newPhaseWithEventPhase({
          focus: event,
          placing: true,
        }),
      });

    } else if (event === EventId.SadavirErrinwright) {
      endEventAndSetGameState({
        ...newState,
        phase: newPhaseWithEventPhase(immediatelyEndableEventPhase),
        board: {
          ...newState.board,
          influence: newState.board.influence.map(bInfluence =>
            map2(bInfluence, i => Math.min(i, 2))),
        },
      });

    } else if (
      event === EventId.Slingshot
      || event === EventId.Nauvoo
      || event === EventId.TheresaYao
      || event === EventId.CaptainYvgeny
    ) {
      setGameState({
        ...newState,
        phase: newPhaseWithEventPhase({ focus: event }),
      });

    } else if (event === EventId.BlackOps) {
      setGameState({
        ...newState,
        phase: newPhaseWithEventPhase({
          focus: event,
          remaining: 3,
          bandPermitted: bands.map(_ => true),
        }),
      });

    } else if (event === EventId.JulieMao) {
      setGameState({
        ...newState,
        phase: newPhaseWithEventPhase({
          focus: event,
          removedBase: nullopt,
        }),
      });

    } else if (event === EventId.StarHelix) {
      setGameState({
        ...newState,
        phase: newPhaseWithEventPhase({
          focus: event,
          remaining: 2,
        }),
      });

    } else if (event === EventId.RiotGear) {
      setGameState({
        ...newState,
        phase: newPhaseWithEventPhase({
          focus: event,
          removedBase: nullopt,
        }),
      });

    } else if (event === EventId.TheHybrid) {
      setGameState({
        ...newState,
        phase: newPhaseWithEventPhase({
          focus: event,
          selected: nullopt,
        }),
      });

    } else if (event === EventId.BobbieDraper) {
      setGameState({
        ...newState,
        phase: newPhaseWithEventPhase({
          focus: event,
          removedOrbital: nullopt,
        }),
      });

    } else if (event === EventId.Ambush) {
      setGameState({
        ...newState,
        phase: newPhaseWithEventPhase({
          focus: event,
          removed: nullopt,
        }),
      });

    } else if (event === EventId.StealthShips) {
      setGameState({
        ...newState,
        phase: newPhaseWithEventPhase({
          focus: event,
          selectedFleet: nullopt,
        }),
      });

    } else if (event === EventId.HeavyBurn) {
      setGameState({
        ...newState,
        phase: newPhaseWithEventPhase({
          focus: event,
          remaining: 2,
          fleetsPermitted: gameState.board.fleets.map(oFleets => oFleets[action]),
          selectedFleetGroup: nullopt,
        }),
      });

    } else if (event === EventId.Razorback) {
      setGameState({
        ...newState,
        phase: newPhaseWithEventPhase({
          focus: event,
          selectedFleet: nullopt,
        }),
      });

    } else if (event === EventId.AdmiralSouther) {
      setGameState({
        ...newState,
        phase: newPhaseWithEventPhase({
          focus: event,
          remaining: gameState.board.fleets.map(f => f[action]).reduce((a, b) => a + b),
          fleetsPermitted: gameState.board.fleets.map(f => f[action]),
          selectedFleetGroup: nullopt,
        }),
      });

    }

  }

  function clickSector(sector: SectorId) {
    if (
      gameState.phase.phase === "score turn deciding sector"
      && gameState.board.bonusSectorsRemaining[sector] > 0
    ) {
      setHistory(history.concat([{
        type: "score",
        card: { type: CardType.Score },
        turn: gameState.phase.turn,
        bonusSector: sector,
        events: [nullopt, nullopt],
      }]));

      if (gameState.board.kept[players[gameState.phase.turn].opposite].length != 0) {
        setGameState({
          ...gameState,
          phase: {
            ...gameState.phase,
            phase: "score turn kept event deciding",
            bonusSector: sector,
            action: players[gameState.phase.turn].opposite,
          },
        });
      } else if (gameState.board.kept[gameState.phase.turn].length != 0) {
        setGameState({
          ...gameState,
          phase: {
            ...gameState.phase,
            phase: "score turn kept event deciding",
            bonusSector: sector,
            action: gameState.phase.turn,
          },
        });
      } else {
        scoreAndSetGameState(opt(sector), {
          ...gameState,
          board: {
            ...gameState.board,
            bonusSectorsRemaining: withMap3(gameState.board.bonusSectorsRemaining, sector, r => r - 1),
          },
          phase: {
            ...gameState.phase,
            phase: "start",
            turn: players[gameState.phase.turn].opposite,
            focus: nullopt,
          },
        });
      }
    }
  }

  function clickOrbital(orbital: OrbitalId) {
    if (
      gameState.phase.phase === "ap turn ap"
      && gameState.phase.selectedFleetGroup.hasValue
    ) {
      if (Math.abs((orbitals[orbital]?.band ?? 0) - (orbitals[gameState.phase.selectedFleetGroup.value.orbital]?.band ?? 0)) > 1) return;

      const phase = gameState.phase;
      const selectedFleetGroup = gameState.phase.selectedFleetGroup;
      reduceApAndSetGameState({
        ...gameState,
        board: {
          ...gameState.board,
          fleets:
            gameState.board.fleets
              .withMap(
                selectedFleetGroup.value.orbital,
                oFleets => withMap2(oFleets, phase.turn, f => f - selectedFleetGroup.value.count)
              )
              .withMap(
                orbital,
                oFleets => withMap2(oFleets, phase.turn, f => f + selectedFleetGroup.value.count)
              ),
        },
        phase: {
          ...gameState.phase,
          selectedFleetGroup: nullopt,
        },
      });
    } else if (
      gameState.phase.phase === "ap turn initiative event"
      || gameState.phase.phase === "event turn event"
      || gameState.phase.phase === "score turn kept event"
    ) {
      const action =
        gameState.phase.phase === "ap turn initiative event"
          ? players[gameState.phase.turn].opposite
          : gameState.phase.phase === "event turn event"
            ? gameState.phase.turn
            : satisfiesCheck<"score turn kept event">(gameState.phase.phase)(gameState.phase.action);

      if (gameState.phase.focus === EventId.Nauvoo) {
        if (gameState.board.fleets[orbital]?.every(i => i == 0)) return;

        endEventAndSetGameState({
          ...gameState,
          phase: gameState.phase,
          board: {
            ...gameState.board,
            fleets: gameState.board.fleets.withMap(orbital, oFleets => withMap2(
              oFleets,
              (oFleets[players[action].opposite] > 0) ? players[action].opposite : action,
              i => i - 1)),
          },
        });

      } else if (gameState.phase.focus === EventId.BobbieDraper) {
        if (gameState.phase.removedOrbital.hasValue) {
          if (gameState.board.fleets[orbital]?.[action] == 0) return;

          endEventAndSetGameState({
            ...gameState,
            phase: gameState.phase,
            board: {
              ...gameState.board,
              fleets:
                gameState.board.fleets
                  .withMap(gameState.phase.removedOrbital.value, oFleets => map2(oFleets, (f, player) =>
                    f + (player == action ? 1 : -1)))
                  .withMap(orbital, oFleets => withMap2(oFleets, action, f => f - 1)),
            },
          });

        } else {
          if (gameState.board.fleets[orbital]?.[players[action].opposite] == 0) return;

          if (gameState.board.fleets.map(oFleets => oFleets[action]).reduce((a, b) => a + b) < FLEET_COUNT) {
            endEventAndSetGameState({
              ...gameState,
              phase: gameState.phase,
              board: {
                ...gameState.board,
                fleets:
                  gameState.board.fleets
                    .withMap(orbital, oFleets => map2(oFleets, (f, player) =>
                      f + (player == action ? 1 : -1))),
              },
            });

          } else {
            setGameState({
              ...gameState,
              phase: {
                ...gameState.phase,
                removedOrbital: opt(orbital),
              },
            });

          }

        }

      } else if (gameState.phase.focus === EventId.CaptainYvgeny) {
        if (gameState.board.fleets[orbital]?.some(i => i == 0)) return;

        endEventAndSetGameState({
          ...gameState,
          phase: gameState.phase,
          board: {
            ...gameState.board,
            fleets: gameState.board.fleets.withMap(orbital, oFleets => withMap2(oFleets, players[action].opposite, i => i - 1)),
          },
        });

      } else if (
        gameState.phase.focus === EventId.HeavyBurn
        || gameState.phase.focus === EventId.AdmiralSouther
      ) {
        if (gameState.phase.selectedFleetGroup.hasValue === false) return;
        if (
          Math.abs((orbitals[orbital]?.band ?? 0) - (orbitals[gameState.phase.selectedFleetGroup.value.orbital]?.band ?? 0))
          > (
            gameState.phase.focus === EventId.HeavyBurn
              ? 2
              : satisfiesCheck<EventId.AdmiralSouther>(gameState.phase.focus)(1)
          )
        ) return;
        const selected = gameState.phase.selectedFleetGroup.value;

        const done = (
          gameState.phase.remaining === 1
          || (gameState.phase.fleetsPermitted.reduce((a, b) => a + b) == 0)
        );
        (done ? endEventAndSetGameState : setGameState)({
          ...gameState,
          phase: {
            ...gameState.phase,
            remaining: (
              gameState.phase.remaining
              - (gameState.phase.focus === EventId.HeavyBurn ? 1 : satisfiesCheck<EventId.AdmiralSouther>(gameState.phase.focus)(selected.count))
            ),
            fleetsPermitted: gameState.phase.fleetsPermitted.withMap(selected.orbital, f => f - selected.count),
            selectedFleetGroup: nullopt,
          },
          board: {
            ...gameState.board,
            fleets:
              gameState.board.fleets
                .withMap(selected.orbital, oFleets => withMap2(oFleets, action, f => f - selected.count))
                .withMap(orbital, oFleets => withMap2(oFleets, action, f => f + selected.count)),
          },
        });

      } else if (gameState.phase.focus === EventId.Razorback) {
        if (gameState.phase.selectedFleet.hasValue) {
          endEventAndSetGameState({
            ...gameState,
            phase: gameState.phase,
            board: {
              ...gameState.board,
              fleets:
                gameState.board.fleets
                  .withMap(gameState.phase.selectedFleet.value, oFleets => withMap2(oFleets, action, f => f - 1))
                  .withMap(orbital, oFleets => withMap2(oFleets, action, f => f + 1)),
            },
          });

        } else {
          if (gameState.board.fleets[orbital]?.[action] == 0) return;

          setGameState({
            ...gameState,
            phase: {
              ...gameState.phase,
              selectedFleet: opt(orbital),
            },
          });

        }

      }
    }
  }

  function clickBase(base: BaseId) {
    if (
      gameState.phase.phase === "ap turn ap"
      && gameState.phase.selectedFleetGroup.hasValue === false
      && (gameState.board.fleets[bases[base]?.orbital ?? 0]?.[gameState.phase.turn] ?? 0) > 0
    ) {
      const phase = gameState.phase;
      reduceApAndSetGameState({
        ...gameState,
        board: {
          ...gameState.board,
          influence:
            gameState.board.influence
              .withMap(
                base,
                bInfluence => withMap2(bInfluence, phase.turn, i => i + 1)
              ),
        },
      });

    } else if (
      gameState.phase.phase === "ap turn initiative event"
      || gameState.phase.phase === "event turn event"
      || gameState.phase.phase === "score turn kept event"
    ) {
      const action =
        gameState.phase.phase === "ap turn initiative event"
          ? players[gameState.phase.turn].opposite
          : gameState.phase.phase === "event turn event"
            ? gameState.phase.turn
            : satisfiesCheck<"score turn kept event">(gameState.phase.phase)(gameState.phase.action);

      if (
        gameState.phase.focus === EventId.VoicesEros
        && bands[orbitals[bases[base]?.orbital ?? 0]?.band ?? 0].sector == gameState.phase.placingSector
      ) {
        const board: typeof gameState.board = {
          ...gameState.board,
          influence: gameState.board.influence.withMap(base, bInfluence => withMap2(bInfluence, action, i => i + 1)),
        };
        if (gameState.phase.placingSector === SectorId.Outer) {
          endEventAndSetGameState({
            ...gameState,
            board,
            phase: gameState.phase,
          });

        } else {
          setGameState({
            ...gameState,
            board,
            phase: {
              ...gameState.phase,
              placingSector: gameState.phase.placingSector + 1,
            },
          });
        }

      } else if (
        gameState.phase.focus === EventId.DestructionDeimos
        && bases[base]?.orbital === OrbitalId.Earth
      ) {
        endEventAndSetGameState({
          ...gameState,
          phase: gameState.phase,
          board: {
            ...gameState.board,
            influence: gameState.board.influence.withMap(base, bInfluence => withMap2(bInfluence, action, i => i + 1)),
          },
        });

      } else if (
        gameState.phase.focus === EventId.BlockadeEarth
        || gameState.phase.focus === EventId.BlockadeMars
      ) {
        if (
          bases[base]?.orbital
          != (
            gameState.phase.focus === EventId.BlockadeEarth
              ? OrbitalId.Earth
              : satisfiesCheck<EventId.BlockadeMars>(gameState.phase.focus)(OrbitalId.Mars)
          )
        ) return;

        if (gameState.phase.placing) {
          (((gameState.board.fleets[bases[base]?.orbital]?.[action] ?? 0) > (gameState.board.fleets[bases[base]?.orbital]?.[players[action].opposite] ?? 0)) ? setGameState : endEventAndSetGameState)({
            ...gameState,
            board: {
              ...gameState.board,
              influence: gameState.board.influence.withMap(base, bInfluence => withMap2(bInfluence, action, i => i + 1)),
            },
            phase: {
              ...gameState.phase,
              placing: false,
            },
          });

        } else if ((gameState.board.influence[base]?.[players[action].opposite] ?? 0) > 0) {
          endEventAndSetGameState({
            ...gameState,
            phase: gameState.phase,
            board: {
              ...gameState.board,
              influence: gameState.board.influence.withMap(base, bInfluence => withMap2(bInfluence, players[action].opposite, i => i - 1)),
            },
          });

        }

      } else if (gameState.phase.focus === EventId.Slingshot) {
        if (bands[orbitals[bases[base]?.orbital ?? 0]?.band ?? 0].sector != SectorId.Outer) return;
        if (gameState.board.influence[base]?.every(i => i == 0)) return;

        endEventAndSetGameState({
          ...gameState,
          phase: gameState.phase,
          board: {
            ...gameState.board,
            influence: gameState.board.influence.withMap(base, bInfluence => withMap2(
              bInfluence,
              (bInfluence[players[action].opposite] > 0) ? players[action].opposite : action,
              i => i - 1)),
          },
        });

      } else if (gameState.phase.focus === EventId.BlackOps) {
        const baseBand: BandId = orbitals[bases[base]?.orbital ?? 0]?.band ?? 0;
        if (
          gameState.phase.bandPermitted[baseBand] === false
          || gameState.board.influence[base]?.[players[action].opposite] == 0
        ) return;

        (gameState.phase.remaining === 1 ? endEventAndSetGameState : setGameState)({
          ...gameState,
          phase: {
            ...gameState.phase,
            remaining: gameState.phase.remaining - 1,
            bandPermitted: gameState.phase.bandPermitted.with(baseBand, false),
          },
          board: {
            ...gameState.board,
            influence: gameState.board.influence.withMap(base, bInfluence => withMap2(bInfluence, players[action].opposite, i => i - 1)),
          },
        });

      } else if (gameState.phase.focus === EventId.JulieMao) {
        if (
          gameState.phase.removedBase.hasValue
          && bases[base]?.resource != bases[gameState.phase.removedBase.value]?.resource
        ) return;
        if (gameState.board.influence[base]?.reduce((a, b) => a + b) == 0) return;

        (gameState.phase.removedBase.hasValue ? endEventAndSetGameState : setGameState)({
          ...gameState,
          phase: {
            ...gameState.phase,
            removedBase: opt(base),
          },
          board: {
            ...gameState.board,
            influence: gameState.board.influence.withMap(base, bInfluence =>
              withMap2(
                bInfluence,
                (bInfluence[players[action].opposite] > 0) ? players[action].opposite : action,
                i => i - 1)),
          },
        });

      } else if (gameState.phase.focus === EventId.StarHelix) {
        if (gameState.board.influence[base]?.some(i => i == 0)) return;

        (gameState.phase.remaining == 1 ? endEventAndSetGameState : setGameState)({
          ...gameState,
          phase: {
            ...gameState.phase,
            remaining: gameState.phase.remaining - 1,
          },
          board: {
            ...gameState.board,
            influence: gameState.board.influence.withMap(base, bInfluence =>
              withMap2(bInfluence, players[action].opposite, i => i - 1)),
          },
        });

      } else if (gameState.phase.focus === EventId.RiotGear) {
        if (
          gameState.phase.removedBase.hasValue
          && gameState.phase.removedBase.value === base
        ) return;
        if (orbitals[bases[base]?.orbital ?? 0]?.band != BandId.Belt) return;
        if (gameState.board.influence[base]?.reduce((a, b) => a + b) == 0) return;

        (gameState.phase.removedBase.hasValue ? endEventAndSetGameState : setGameState)({
          ...gameState,
          phase: {
            ...gameState.phase,
            removedBase: opt(base),
          },
          board: {
            ...gameState.board,
            influence: gameState.board.influence.withMap(base, bInfluence => withMap2(
              bInfluence,
              (bInfluence[players[action].opposite] > 0) ? players[action].opposite : action,
              i => i - 1)),
          },
        });

      } else if (gameState.phase.focus === EventId.TheHybrid) {
        const topDeck = gameState.board.deck[0];
        if (topDeck === undefined) throw `empty deck`;

        if (
          topDeck.type === CardType.Event
          && gameState.board.kept[action].some(e => e == EventId.MaoKwik)
        ) {
          setGameState({
            ...gameState,
            phase: {
              ...gameState.phase,
              selected: opt({
                base,
                topEvent: topDeck.event,
              }),
            },
          });

        } else {
          endEventAndSetGameState({
            ...gameState,
            phase: gameState.phase,
            board: {
              ...gameState.board,
              influence: gameState.board.influence.withMap(base, influence => {
                const toRemove =
                  topDeck.type === CardType.Event
                    ? (events[topDeck.event]?.ap ?? 0)
                    : 1_000_000;
                return map2(influence, (i, p) =>
                  (p != action)
                    ? i - Math.min(i, toRemove)
                    : i - Math.min(i, toRemove - Math.min(influence[players[p].opposite], toRemove))
                );
              }),
            },
          });

        }

      } else if (gameState.phase.focus === EventId.Nauvoo) {
        if (gameState.board.influence[base]?.every(i => i == 0)) return;

        endEventAndSetGameState({
          ...gameState,
          phase: gameState.phase,
          board: {
            ...gameState.board,
            influence: gameState.board.influence.withMap(base, bInfluence => withMap2(
              bInfluence,
              (bInfluence[players[action].opposite] > 0) ? players[action].opposite : action,
              i => i - 1)),
          },
        });

      }
    }
  }

  const lineWidth = "0.1dvw";

  return (
    <div style={{ display: "flex", width: "100%", height: "100%", userSelect: "none", cursor: "default" }}>
      <div style={{ flex: 1, width: "100%", height: "100%", position: "relative" }}>
        <div // line
          style={{
            width: "0.1dvw",
            height: "100%",
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            background:
              "  linear-gradient("
              + "  to bottom, "
              + "  rgba(82, 162, 253, 1.0) 0%,"
              + "  rgba(82, 162, 253, 1.0) 50%,"
              + "  rgba(109, 164, 228, 0.4) 60%,"
              + "  rgba(123, 154, 189, 0) 95%"
              + ")",
            zIndex: 1,
          }}
        />
        <div style={{ // timeline content
          width: "100%",
          height: "100%",
          boxSizing: "border-box",
          position: "relative",
        }}>
          {
            (() => {
              const maxHistoryLength = (NONSCORES_PER_PILE + SCORES_PER_PILE) * PILES;
              const maxHistoryFlex = 0.4;
              const totalHistoryFlex = lerp(0, maxHistoryFlex, Math.pow(history.length / maxHistoryLength, 0.8));
              const historyFlexes = (() => {
                if (history.length === 0) return [];
                const unnormalized = history.map((_, iHistory) =>
                  Math.pow(
                    1 - ((history.length - iHistory) / maxHistoryLength),
                    lerp(1, 3, Math.pow(history.length / maxHistoryLength, 0.2))
                  ));
                const totalUnnormalized = unnormalized.reduce((a, b) => a + b);
                const minPerHistory = 0.7 / maxHistoryLength;
                return unnormalized.map(x => minPerHistory + x * totalHistoryFlex / Math.max(0.01, totalUnnormalized - minPerHistory * history.length));
              })();
              //const minHistoryMargin = "0.2dvh";
              const transitionTime = "0.4s";
              const borderColor = "rgba(82, 162, 253, 1.0)";

              const pastDotWidth = "0.6dvh";
              const pastBorderWidth = "0.2dvh";
              const todayDotWidth = "1.1dvh";
              const todayBorderWidth = "0.3dvh";
              const historyTodayMargin = 0;//`calc(${todayDotWidth} / 2 + ${todayBorderWidth} / 2 - ${pastDotWidth} / 2 - ${pastBorderWidth}`;
              const trackHeight = "10dvh";
              const sharedTrackSpacing = 0.2;
              const motionTransition: Transition<any> = { type: "tween", duration: parseFloat(transitionTime.substring(0, transitionTime.length - 1)), ease: "easeInOut" };

              return <>
                <div // padding
                  style={{
                    height: `calc(8dvh - ${lerp(0, maxHistoryFlex, Math.pow(totalHistoryFlex / maxHistoryFlex, 2.5)) * 100}%)`,
                    minHeight: "2dvh",
                    transition: `height ${transitionTime} ease-in-out`,
                  }}
                />
                {
                  [
                    ...history.map((historyItem, iHistory) => {
                      const key = (() => {
                        if (historyItem.card.type === CardType.Score) return `score ${iHistory}`;
                        if (historyItem.type === "play kept") return `kept ${iHistory}`;
                        return `event ${historyItem.card.event}`;
                      })();
                      return <motion.div // history card
                        key={key}
                        layout="position"
                        layoutId={key}
                        transition={motionTransition}
                        style={{
                          width: "100%",
                          height: `${(historyFlexes[iHistory] ?? 0) * (totalHistoryFlex / historyFlexes.reduce((a, b) => a + b)) * 100}%`,
                          //minHeight: `calc(${pastDotWidth} + ${pastBorderWidth} * 2 + ${minHistoryMargin})`,
                          minHeight: 0,
                          position: "relative",
                          transition: `height ${transitionTime} ease-in-out, min-height ${transitionTime} ease-in-out, transform ${transitionTime} ease-in-out`,
                          zIndex: 2,
                        }}
                      >
                        <motion.div // dot
                          layout
                          transition={motionTransition}
                          style={{
                            width: pastDotWidth,
                            height: pastDotWidth,
                            position: "absolute",
                            left: "50%",
                            top: "0%",
                            x: "-50%",
                            y: "-50%",
                            backgroundColor:
                              historyItem.type === "score"
                                ? "gold"
                                : historyItem.turn === PlayerId.MCR
                                  ? "red"
                                  : "blue",
                            border: `${pastBorderWidth} solid ${borderColor}`,
                            borderRadius: "50%",
                          }}
                        />
                        <motion.div // card box
                          layout
                          transition={motionTransition}
                          style={{
                            width: "50%",
                            position: "absolute",
                            left: historyItem.turn === 0 ? "0%" : "50%",
                            y: "-50%",
                            paddingLeft: "1dvw",
                            paddingRight: "1dvw",
                            boxSizing: "border-box",
                            opacity: 0,
                          }}>
                          <div
                            style={{
                              position: "relative",
                              border: "0.3dvw solid black",
                            }}
                          >
                            <div style={{
                              width: "0.25dvw",
                              height: "0.25dvw",
                              position: "absolute",
                              top: "50%",
                              ...(
                                historyItem.turn === 0
                                  ? {
                                    right: 0,
                                    transform: `translate(calc(0.3dvw + 50%), -50%) rotate(45deg)`,
                                  }
                                  : {
                                    left: 0,
                                    transform: `translate(calc(-0.3dvw - 50%), -50%) rotate(calc(45deg - 180deg))`,
                                  }
                              ),
                              borderTop: "0.3dvw solid black",
                              borderRight: "0.3dvw solid black",
                            }} />
                            {
                              historyItem.card.type === CardType.Score
                                ? <div style={{ fontSize: 32, width: 200 }}>Score</div>
                                : eventCardDivs[historyItem.card.event]
                            }
                          </div>
                        </motion.div>
                      </motion.div >;
                    }),

                    ...(() => { // focus
                      if (gameState.phase.phase === "game over") return [];
                      const focus = ((): Optional<Card> => {
                        if (gameState.phase.phase === "start") return optMap(gameState.phase.focus, event => ({ type: CardType.Event, event }));
                        if (
                          gameState.phase.phase === "score turn deciding sector"
                          || gameState.phase.phase === "score turn kept event"
                          || gameState.phase.phase === "score turn kept event deciding"
                        ) return opt({ type: CardType.Score });
                        return opt({ type: CardType.Event, event: gameState.phase.focus });
                      })();
                      if (focus.hasValue === false) return [];

                      const key = (() => {
                        if (focus.value.type === CardType.Score) return `score ${history.length}`;
                        const focusValue = focus.value;
                        if (history.some(h => h.card.type === CardType.Event && h.card.event === focusValue.event)) return `kept ${history.length}`;
                        return `event ${focus.value.event}`;
                      })();

                      return [<motion.div
                        key={key}
                        layout="position"
                        layoutId={key}
                        transition={motionTransition}
                        style={{
                          width: "100%",
                          height: "0dvh",
                          minHeight: 0,
                          position: "relative",
                          transition: `height ${transitionTime} ease-in-out, min-height ${transitionTime} ease-in-out`,
                          zIndex: 2,
                        }}
                      >
                        <motion.div // dot
                          layout
                          transition={motionTransition}
                          style={{
                            width: `0.6dvh`,
                            height: `0.6dvh`,
                            position: "absolute",
                            left: "50%",
                            top: "0%",
                            x: "-50%",
                            y: "-50%",
                            backgroundColor:
                              focus.value.type === CardType.Score
                                ? "gold"
                                : gameState.phase.turn === PlayerId.MCR
                                  ? "red"
                                  : "blue",
                            border: `0.2dvh solid ${borderColor}`,
                            borderRadius: "50%",
                          }}
                        />
                        <motion.div // card box
                          layout
                          transition={motionTransition}
                          style={{
                            width: "50%",
                            position: "absolute",
                            left: gameState.phase.turn === 0 ? "0%" : "50%",
                            y: "-50%",
                            paddingLeft: "1dvw",
                            paddingRight: "1dvw",
                            boxSizing: "border-box",
                          }}>
                          <div
                            style={{
                              position: "relative",
                              border: "0.3dvw solid black",
                            }}
                          >
                            <div style={{
                              width: "0.25dvw",
                              height: "0.25dvw",
                              position: "absolute",
                              top: "50%",
                              ...(
                                gameState.phase.turn === 0
                                  ? {
                                    right: 0,
                                    transform: `translate(calc(0.3dvw + 50%), -50%) rotate(45deg)`,
                                  }
                                  : {
                                    left: 0,
                                    transform: `translate(calc(-0.3dvw - 50%), -50%) rotate(calc(45deg - 180deg))`,
                                  }
                              ),
                              borderTop: "0.3dvw solid black",
                              borderRight: "0.3dvw solid black",
                            }} />
                            {
                              focus.value.type === CardType.Score
                                ? <div style={{ fontSize: 32, width: 200 }}>Score</div>
                                : eventCardDivs[focus.value.event]
                            }
                          </div>
                        </motion.div>
                      </motion.div>];
                    })(),

                    <motion.div // today
                      key="today"
                      layout
                      layoutId="today"
                      transition={motionTransition}
                      style={{
                        width: "100%",
                        position: "relative",
                      }}>
                      <div // dot
                        style={{
                          width: todayDotWidth,
                          height: todayDotWidth,
                          position: "absolute",
                          left: "50%",
                          top: `calc(${todayBorderWidth} / 2)`,
                          transform: "translate(-50%, -50%)",
                          backgroundColor: (gameState.phase.phase === "game over" || gameState.phase.turn === PlayerId.MCR) ? "red" : "blue",
                          border: `${todayBorderWidth} solid ${borderColor}`,
                          borderRadius: "50%",
                          zIndex: 4,
                          transition: `background-color ${transitionTime} ease-in-out`,
                        }}
                      />
                      <motion.div // date box
                        layout
                        transition={motionTransition}
                        style={{
                          position: "relative",
                          marginTop: historyTodayMargin,
                          marginBottom: "1dvh",
                          backgroundColor: "rgba(200, 200, 200, 1.0)",
                          zIndex: 3,
                          display: "flex",
                          ...(
                            (
                              gameState.phase.phase === "game over"
                              || (
                                gameState.phase.phase === "start"
                                && gameState.phase.focus.hasValue === false
                              )
                            )
                              ? {
                                width: "60%",
                                height: "5dvh",
                                marginLeft: "20%",
                              }
                              : {
                                width: `calc(50% - 1dvw + ${lineWidth} / 2)`,
                                height: `calc(5dvh - ${todayDotWidth} / 2 - ${todayBorderWidth} / 2)`,
                                marginLeft: gameState.phase.turn === 0 ? `calc(50% - ${lineWidth} / 2)` : "1dvw",
                              }
                          ),
                        }}
                      >
                        <motion.div // border
                          layout
                          transition={motionTransition}
                          style={{
                            flexGrow: 1,
                            border: `${todayBorderWidth} solid ${borderColor}`,
                            borderRadius: "5%",
                            display: "flex",
                          }}>
                          <motion.div // text container (scaling)
                            layout
                            transition={motionTransition}
                            style={{
                              flexGrow: 1,
                              marginTop:
                                (
                                  gameState.phase.phase === "game over"
                                  || (
                                    gameState.phase.phase === "start"
                                    && gameState.phase.focus.hasValue === false
                                  )
                                )
                                  ? `calc(${todayDotWidth} / 2 + ${todayBorderWidth} / 2)`
                                  : 0,
                              fontSize: "1.8cqh",
                              justifyItems: "center",
                              alignContent: "center",
                            }}>
                            <motion.div // text (non-scaling)
                              layout="position"
                              transition={motionTransition}
                            >
                              {
                                new Date(new Date().getFullYear() + 300, 0, 1 + (history.length / maxHistoryLength) * 366)
                                  .toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
                              }
                            </motion.div>
                          </motion.div>
                        </motion.div>
                      </motion.div>
                    </motion.div>,

                    <motion.div // buttons
                      key="buttons"
                      layout="position"
                      transition={motionTransition}
                      layoutId="buttons"
                      style={{
                        width: "100%",
                        justifyItems: "center",
                      }}
                    >
                      <div style={{
                        margin: "1dvw",
                        display:
                          (
                            (
                              gameState.phase.phase === "start"
                              && gameState.phase.focus.hasValue
                            )
                            || (gameState.phase.phase === "ap turn deciding mao-kwik")
                            || (
                              (
                                gameState.phase.phase === "ap turn initiative event"
                                || gameState.phase.phase === "event turn event"
                                || gameState.phase.phase === "score turn kept event"
                              )
                              && gameState.phase.focus === EventId.TheHybrid
                              && gameState.phase.selected.hasValue
                            )

                            || (
                              gameState.phase.phase === "start"
                              && gameState.phase.focus.hasValue
                              && gameState.phase.focus.value != EventId.Miller
                              && gameState.phase.focus.value != EventId.MaoKwik
                              && events[gameState.phase.focus.value]?.factions[gameState.phase.turn]
                            )
                            || (
                              gameState.phase.phase === "ap turn initiative deciding"
                              && gameState.phase.focus != EventId.Miller
                              && gameState.phase.focus != EventId.MaoKwik
                            )

                            || (
                              gameState.phase.phase === "start"
                              && gameState.phase.focus.hasValue
                              && gameState.board.cp[gameState.phase.turn] >= (events[gameState.phase.focus.value]?.keepCost ?? 0)
                              && events[gameState.phase.focus.value]?.factions[gameState.phase.turn]
                            )
                            || (
                              gameState.phase.phase === "ap turn initiative deciding"
                              && gameState.board.cp[players[gameState.phase.turn].opposite] >= (events[gameState.phase.focus]?.keepCost ?? 0)
                              && events[gameState.phase.focus]?.factions[players[gameState.phase.turn].opposite]
                            )

                            || (gameState.phase.phase === "ap turn deciding miller")
                            || (gameState.phase.phase === "ap turn initiative deciding")
                            || (gameState.phase.phase === "score turn kept event deciding")
                            || (
                              (
                                gameState.phase.phase === "ap turn initiative event"
                                || gameState.phase.phase === "event turn event"
                                || gameState.phase.phase === "score turn kept event"
                              )
                              && (
                                (
                                  gameState.phase.focus === EventId.Assassin
                                  && gameState.board.kept[gameState.phase.assassinAction].length == 0
                                )
                                || (
                                  gameState.phase.focus === EventId.CovertOp
                                  && gameState.board.influence.reduce((a, b) => [a[0] + b[0], a[1] + b[1]]).some(pInfluence => pInfluence == 0)
                                )
                                || (
                                  (
                                    gameState.phase.focus === EventId.BlockadeEarth
                                    || gameState.phase.focus === EventId.BlockadeMars
                                  )
                                  && gameState.phase.placing === false
                                )
                                || (gameState.phase.focus === EventId.BlackOps)
                                || (
                                  gameState.phase.focus === EventId.JulieMao
                                  && (() => {
                                    if (gameState.phase.removedBase.hasValue) {
                                      const removedBase = gameState.phase.removedBase.value;
                                      return (
                                        gameState.board.influence
                                          .filter((_, base) => bases[base]?.resource === bases[removedBase]?.resource)
                                          .reduce((total, bInfluence) => total + bInfluence.reduce((a, b) => a + b), 0)
                                        == 0
                                      );

                                    } else {
                                      return (gameState.board.influence.reduce((total, bInfluence) => total + bInfluence.reduce((a, b) => a + b), 0) == 0);
                                    }
                                  })()
                                )
                                || (
                                  gameState.phase.focus === EventId.StarHelix
                                  && gameState.board.influence.every(bInfluence => bInfluence.some(i => i == 0))
                                )
                                || (gameState.phase.focus === EventId.RiotGear)
                                || (gameState.phase.focus === EventId.Ambush)
                                || (gameState.phase.focus === EventId.HeavyBurn)
                                || (gameState.phase.focus === EventId.AdmiralSouther)
                              )
                            )
                          )
                            ? "flex"
                            : "none"
                      }}>
                        <button
                          disabled={!(
                            (
                              gameState.phase.phase === "start"
                              && gameState.phase.focus.hasValue
                            )
                            || (gameState.phase.phase === "ap turn deciding mao-kwik")
                            || (
                              (
                                gameState.phase.phase === "ap turn initiative event"
                                || gameState.phase.phase === "event turn event"
                                || gameState.phase.phase === "score turn kept event"
                              )
                              && gameState.phase.focus === EventId.TheHybrid
                              && gameState.phase.selected.hasValue
                            )
                          )}
                          onClick={() => {
                            if (
                              gameState.phase.phase === "start"
                              && gameState.phase.focus.hasValue
                            ) {
                              if (gameState.board.kept[gameState.phase.turn].some(kc => kc === EventId.MaoKwik)) {
                                setGameState({
                                  ...gameState,
                                  phase: {
                                    ...gameState.phase,
                                    phase: "ap turn deciding mao-kwik",
                                    focus: gameState.phase.focus.value,
                                  },
                                });
                              } else {
                                setGameState({
                                  ...gameState,
                                  phase: {
                                    ...gameState.phase,
                                    phase: "ap turn ap",
                                    focus: gameState.phase.focus.value,
                                    ap: events[gameState.phase.focus.value]?.ap ?? 0,
                                    selectedFleetGroup: nullopt,
                                  },
                                });
                              }

                            } else if (
                              gameState.phase.phase === "ap turn deciding mao-kwik"
                            ) {
                              setGameState({
                                ...gameState,
                                phase: {
                                  ...gameState.phase,
                                  phase: "ap turn ap",
                                  focus: gameState.phase.focus,
                                  ap: events[gameState.phase.focus]?.ap ?? 0,
                                  selectedFleetGroup: nullopt,
                                },
                              });

                            } else if (
                              (
                                gameState.phase.phase === "ap turn initiative event"
                                || gameState.phase.phase === "event turn event"
                                || gameState.phase.phase === "score turn kept event"
                              )
                              && gameState.phase.focus === EventId.TheHybrid
                              && gameState.phase.selected.hasValue
                            ) {
                              const action =
                                gameState.phase.phase === "ap turn initiative event"
                                  ? players[gameState.phase.turn].opposite
                                  : gameState.phase.phase === "event turn event"
                                    ? gameState.phase.turn
                                    : gameState.phase.action;

                              const selected = gameState.phase.selected;
                              endEventAndSetGameState({
                                ...gameState,
                                board: {
                                  ...gameState.board,
                                  influence: gameState.board.influence.withMap(selected.value.base, influence => {
                                    const toRemove = events[selected.value.topEvent]?.ap;
                                    if (toRemove === undefined) throw `bad topEvent`;
                                    return map2(influence, (i, p) =>
                                      (p != action)
                                        ? i - Math.min(i, toRemove)
                                        : i - Math.min(i, toRemove - Math.min(influence[players[p].opposite], toRemove))
                                    );
                                  }),
                                },
                                phase: gameState.phase,  // typescript sure is silly sometimes ain't it
                              });
                            }
                          }}
                        >
                          Use AP
                        </button>
                        <button
                          disabled={!(
                            (
                              gameState.phase.phase === "start"
                              && gameState.phase.focus.hasValue
                              && gameState.phase.focus.value != EventId.Miller
                              && gameState.phase.focus.value != EventId.MaoKwik
                              && events[gameState.phase.focus.value]?.factions[gameState.phase.turn]
                            )
                            || (
                              gameState.phase.phase === "ap turn initiative deciding"
                              && gameState.phase.focus != EventId.Miller
                              && gameState.phase.focus != EventId.MaoKwik
                            )
                          )}
                          onClick={() => {
                            if (
                              gameState.phase.phase === "start"
                              && gameState.phase.focus.hasValue
                              && gameState.phase.focus.value != EventId.Miller
                              && gameState.phase.focus.value != EventId.MaoKwik
                            ) {
                              setHistory(history.concat([{
                                type: "track event",
                                turn: gameState.phase.turn,
                                card: {
                                  type: CardType.Event,
                                  event: gameState.phase.focus.value,
                                },
                              }]));

                              const phase = gameState.phase;
                              startEventAndSetGameState(
                                {
                                  ...gameState,
                                  phase: gameState.phase,
                                },
                                eventPhase => ({
                                  ...phase,
                                  ...eventPhase,
                                  phase: "event turn event",
                                }),
                                gameState.phase.focus.value
                              );
                            } else if (
                              gameState.phase.phase === "ap turn initiative deciding"
                              && gameState.phase.focus != EventId.Miller
                              && gameState.phase.focus != EventId.MaoKwik
                            ) {
                              setHistory(history.concat([{
                                type: "track ap",
                                turn: gameState.phase.turn,
                                card: { type: CardType.Event, event: gameState.phase.focus },
                                eventUse: "initiative use",
                              }]));

                              const phase = gameState.phase;
                              startEventAndSetGameState(
                                {
                                  ...gameState,
                                  phase: gameState.phase,
                                },
                                eventPhase => ({
                                  ...phase,
                                  ...eventPhase,
                                  phase: "ap turn initiative event",
                                }),
                                gameState.phase.focus
                              );
                            }
                          }}
                        >
                          Use Event
                        </button>
                        <button
                          disabled={!(
                            (
                              gameState.phase.phase === "start"
                              && gameState.phase.focus.hasValue
                              && gameState.board.cp[gameState.phase.turn] >= (events[gameState.phase.focus.value]?.keepCost ?? 0)
                              && events[gameState.phase.focus.value]?.factions[gameState.phase.turn]
                            )
                            || (
                              gameState.phase.phase === "ap turn initiative deciding"
                              && gameState.board.cp[players[gameState.phase.turn].opposite] >= (events[gameState.phase.focus]?.keepCost ?? 0)
                              && events[gameState.phase.focus]?.factions[players[gameState.phase.turn].opposite]
                            )
                          )}
                          onClick={() => {
                            if (
                              gameState.phase.phase === "start"
                              && gameState.phase.focus.hasValue
                            ) {
                              setHistory(history.concat([{
                                type: "keep track",
                                turn: gameState.phase.turn,
                                card: {
                                  type: CardType.Event,
                                  event: gameState.phase.focus.value,
                                },
                              }]));
                              setCompletedHistoryLength(completedHistoryLength + 1);

                              const focus = gameState.phase.focus;
                              drawAndSetGameState({
                                ...gameState,
                                board: {
                                  ...gameState.board,
                                  cp: withMap2(gameState.board.cp, gameState.phase.turn, (cp) => cp - (events[focus.value]?.keepCost ?? 0)),
                                  kept: withMap2(gameState.board.kept, gameState.phase.turn, (kept) => kept.concat(focus.value)),
                                },
                                phase: {
                                  ...gameState.phase,
                                  phase: "start",
                                  turn: players[gameState.phase.turn].opposite,
                                  focus: nullopt,
                                },
                              });
                            } else if (
                              gameState.phase.phase === "ap turn initiative deciding"
                            ) {
                              setHistory(history.concat([{
                                type: "track ap",
                                turn: gameState.phase.turn,
                                card: { type: CardType.Event, event: gameState.phase.focus },
                                eventUse: "initiative keep",
                              }]));
                              setCompletedHistoryLength(completedHistoryLength + 1);

                              const phase = gameState.phase;
                              const player = players[gameState.phase.turn].opposite;
                              drawAndSetGameState({
                                ...gameState,
                                board: {
                                  ...gameState.board,
                                  cp: withMap2(gameState.board.cp, player, (cp) => cp - (events[phase.focus]?.keepCost ?? 0)),
                                  kept: withMap2(gameState.board.kept, player, (kept) => kept.concat(phase.focus)),
                                },
                                phase: {
                                  ...gameState.phase,
                                  phase: "start",
                                  turn: player,
                                  focus: nullopt,
                                },
                              });
                            }
                          }}
                        >
                          Keep Event
                        </button>
                        <button
                          disabled={!(
                            (gameState.phase.phase === "ap turn deciding miller")
                            || (gameState.phase.phase === "ap turn initiative deciding")
                            || (gameState.phase.phase === "score turn kept event deciding")
                            || (
                              (
                                gameState.phase.phase === "ap turn initiative event"
                                || gameState.phase.phase === "event turn event"
                                || gameState.phase.phase === "score turn kept event"
                              )
                              && (
                                (
                                  gameState.phase.focus === EventId.Assassin
                                  && gameState.board.kept[gameState.phase.assassinAction].length == 0
                                )
                                || (
                                  gameState.phase.focus === EventId.CovertOp
                                  && gameState.board.influence.reduce((a, b) => [a[0] + b[0], a[1] + b[1]]).some(pInfluence => pInfluence == 0)
                                )
                                || (
                                  (
                                    gameState.phase.focus === EventId.BlockadeEarth
                                    || gameState.phase.focus === EventId.BlockadeMars
                                  )
                                  && gameState.phase.placing === false
                                )
                                || (gameState.phase.focus === EventId.BlackOps)
                                || (
                                  gameState.phase.focus === EventId.JulieMao
                                  && (() => {
                                    if (gameState.phase.removedBase.hasValue) {
                                      const removedBase = gameState.phase.removedBase.value;
                                      return (
                                        gameState.board.influence
                                          .filter((_, base) => bases[base]?.resource === bases[removedBase]?.resource)
                                          .reduce((total, bInfluence) => total + bInfluence.reduce((a, b) => a + b), 0)
                                        == 0
                                      );

                                    } else {
                                      return (gameState.board.influence.reduce((total, bInfluence) => total + bInfluence.reduce((a, b) => a + b), 0) == 0);
                                    }
                                  })()
                                )
                                || (
                                  gameState.phase.focus === EventId.StarHelix
                                  && gameState.board.influence.every(bInfluence => bInfluence.some(i => i == 0))
                                )
                                || (gameState.phase.focus === EventId.RiotGear)
                                || (gameState.phase.focus === EventId.Ambush)
                                || (gameState.phase.focus === EventId.HeavyBurn)
                                || (gameState.phase.focus === EventId.AdmiralSouther)
                              )
                            )
                          )}
                          onClick={() => {
                            if (gameState.phase.phase === "ap turn deciding miller") {
                              setGameState({
                                ...gameState,
                                phase: {
                                  ...gameState.phase,
                                  phase: "ap turn initiative deciding",
                                },
                              });

                            } else if (gameState.phase.phase === "ap turn initiative deciding") {
                              setHistory(history.concat([{
                                type: "track ap",
                                turn: gameState.phase.turn,
                                card: { type: CardType.Event, event: gameState.phase.focus },
                                eventUse: "pass",
                              }]));
                              setCompletedHistoryLength(completedHistoryLength + 1);

                              drawAndSetGameState({
                                ...gameState,
                                phase: {
                                  ...gameState.phase,
                                  phase: "start",
                                  turn: players[gameState.phase.turn].opposite,
                                  focus: nullopt,
                                },
                              });

                            } else if (gameState.phase.phase === "score turn kept event deciding") {
                              if (
                                gameState.phase.action != gameState.phase.turn
                                && gameState.board.kept[gameState.phase.turn].length > 0
                              ) {
                                setGameState({
                                  ...gameState,
                                  phase: {
                                    ...gameState.phase,
                                    action: gameState.phase.turn,
                                  },
                                });
                              } else {
                                scoreAndSetGameState(opt(gameState.phase.bonusSector), {
                                  ...gameState,
                                  board: {
                                    ...gameState.board,
                                    bonusSectorsRemaining: withMap3(gameState.board.bonusSectorsRemaining, gameState.phase.bonusSector, r => r - 1),
                                  },
                                  phase: {
                                    ...gameState.phase,
                                    phase: "start",
                                    turn: players[gameState.phase.turn].opposite,
                                    focus: nullopt,
                                  },
                                });
                              }
                            } else if (
                              (
                                gameState.phase.phase === "ap turn initiative event"
                                || gameState.phase.phase === "event turn event"
                                || gameState.phase.phase === "score turn kept event"
                              )
                            ) {
                              const action =
                                gameState.phase.phase === "ap turn initiative event"
                                  ? players[gameState.phase.turn].opposite
                                  : gameState.phase.phase === "event turn event"
                                    ? gameState.phase.turn
                                    : satisfiesCheck<"score turn kept event">(gameState.phase.phase)(gameState.phase.action);
                              if (gameState.phase.focus === EventId.Assassin) {
                                if (
                                  gameState.phase.assassinAction == action
                                  && gameState.board.kept[players[action].opposite].length > 0
                                ) {
                                  setGameState({
                                    ...gameState,
                                    phase: {
                                      ...gameState.phase,
                                      assassinAction: players[action].opposite,
                                    },
                                  });
                                } else {
                                  endEventAndSetGameState({
                                    ...gameState,
                                    phase: gameState.phase,
                                  });
                                }

                              } else {
                                endEventAndSetGameState({
                                  ...gameState,
                                  phase: gameState.phase,
                                });
                              }
                            }
                          }}
                        >
                          Pass
                        </button>
                      </div>
                    </motion.div>,

                    <motion.div // scores
                      key="scores"
                      layout="position"
                      layoutId="scores"
                      transition={motionTransition}
                      style={{
                        width: "100%",
                        display: "grid",
                        gridTemplateColumns: "repeat(2, 1fr)",
                        gap: "1dvw",
                        paddingLeft: "0.5dvw",
                        paddingRight: "0.5dvw",
                        boxSizing: "border-box",
                      }}
                    >
                      {
                        players.map(player =>
                          <div
                            key={player.id}
                            style={{
                              alignSelf: "start",
                              display: "grid",
                              gridTemplateAreas: `${player.id === 0 ? `"icon cp"` : `"cp icon"`} "fleets fleets" "keptLabel keptLabel" "keptList keptList"`,
                              placeItems: "center",
                              rowGap: "0.4dvw",
                              paddingTop: "0.4dvw",
                              paddingBottom: "0.4dvw",
                              border: gameState.phase.phase !== "game over" && gameState.phase.turn === player.id ? "0.2dvw solid gray" : undefined,
                              borderRadius: "20%",
                            }}>
                            <span style={{ gridArea: "icon", fontSize: "3.5cqw" }}>{player.id === PlayerId.MCR ? "🎴" : "🌐"}</span>
                            <span style={{ gridArea: "cp", fontSize: "3.5cqw" }}>{gameState.board.cp[player.id]}</span>
                            <span style={{ gridArea: "fleets", fontSize: "1.2cqw" }}>{(() => {
                              const fleets = gameState.board.fleets.map(oFleets => oFleets[player.id]).reduce((a, b) => a + b);
                              return Array(fleets).fill(false).map((_, iFleet) =>
                                <span key={iFleet} style={{ opacity: iFleet < fleets ? 1 : 0.3 }} >{player.id === PlayerId.MCR ? "🚀" : "🛸"}</span>);
                            })()}</span>
                            <span style={{ gridArea: "keptLabel", fontSize: "1.2cqw" }}>{(() => {
                              const kept = gameState.board.kept[player.id].length;
                              if (kept == 0) return "";
                              return `${kept} kept ${kept == 1 ? "card" : "cards"}`;
                            })()}</span>
                            <style>{`
                              .no-scrollbar::-webkit-scrollbar {
                                display: none;
                              }
                            `}</style>
                            <div
                              className="no-scrollbar"
                              style={{
                                width: "100%",
                                ...(
                                  gameState.board.kept[player.id].length === 0
                                    ? {
                                      maxHeight: 0,
                                      marginBottom: 0,
                                      maskImage: "",
                                    }
                                    : (
                                      gameState.phase.phase === "game over"
                                      || gameState.phase.turn != player.id
                                    )
                                      ? {
                                        maxHeight: `calc(${trackHeight} * 0.25)`,
                                        marginBottom: 0,
                                        maskImage: "linear-gradient(to bottom, black 0%, transparent 100%)",
                                      }
                                      : {
                                        maxHeight: `calc(${trackHeight} * 1.25)`,
                                        marginBottom: "1dvw",
                                        maskImage: "linear-gradient(to bottom, black 80%, transparent 100%)",
                                      }
                                ),
                                gridArea: "keptList",
                                overflowY:
                                  (
                                    gameState.phase.phase === "game over"
                                    || gameState.phase.turn != player.id
                                  ) ? "clip" : "scroll",
                              }}>
                              {
                                gameState.board.kept[player.id].map(event =>
                                  <div  // kept card
                                    style={{
                                      width: "100%",
                                      marginBottom: "1dvw",
                                      position: "relative",
                                      paddingLeft: "0.5dvw",
                                      paddingRight: "0.5dvw",
                                      boxSizing: "border-box",
                                    }}
                                  >
                                    <div // border
                                      style={{
                                        border: "0.3dvw solid black",
                                      }}
                                      onClick={() => {
                                        if (event == EventId.Miller) {
                                          if (
                                            gameState.phase.phase === "ap turn deciding miller"
                                            && gameState.phase.focus != EventId.Miller
                                            && gameState.phase.focus != EventId.MaoKwik
                                          ) {
                                            setHistory(history.concat([{
                                              type: "track ap",
                                              turn: gameState.phase.turn,
                                              card: {
                                                type: CardType.Event,
                                                event: gameState.phase.focus,
                                              },
                                              eventUse: "self miller",
                                            }]));

                                            const phase = gameState.phase;
                                            startEventAndSetGameState(
                                              {
                                                ...gameState,
                                                phase: gameState.phase,
                                                board: {
                                                  ...gameState.board,
                                                  kept: withMap2(gameState.board.kept, player.id, kept => kept.filter(e => e != EventId.Miller)),
                                                },
                                              },
                                              eventPhase => ({
                                                ...phase,
                                                ...eventPhase,
                                                phase: "event turn event",
                                              }),
                                              gameState.phase.focus
                                            );
                                          }

                                        } else if (event == EventId.MaoKwik) {
                                          if (gameState.phase.phase === "ap turn deciding mao-kwik") {
                                            setGameState({
                                              ...gameState,
                                              board: {
                                                ...gameState.board,
                                                kept: withMap2(gameState.board.kept, player.id, kept => kept.filter(e => e != EventId.MaoKwik)),
                                              },
                                              phase: {
                                                ...gameState.phase,
                                                phase: "ap turn ap",
                                                ap: 4,
                                                selectedFleetGroup: nullopt,
                                              },
                                            });

                                          } else if (
                                            (
                                              gameState.phase.phase === "ap turn initiative event"
                                              || gameState.phase.phase === "event turn event"
                                              || gameState.phase.phase === "score turn kept event"
                                            )
                                            && gameState.phase.focus === EventId.TheHybrid
                                            && gameState.phase.selected.hasValue
                                          ) {
                                            const action =
                                              gameState.phase.phase === "ap turn initiative event"
                                                ? players[gameState.phase.turn].opposite
                                                : gameState.phase.phase === "event turn event"
                                                  ? gameState.phase.turn
                                                  : gameState.phase.action;

                                            const selected = gameState.phase.selected;
                                            endEventAndSetGameState({
                                              ...gameState,
                                              board: {
                                                ...gameState.board,
                                                influence: gameState.board.influence.withMap(selected.value.base, influence => {
                                                  const toRemove = events[selected.value.topEvent]?.ap;
                                                  if (toRemove === undefined) throw `bad topEvent`;
                                                  return map2(influence, (i, p) =>
                                                    (p != action)
                                                      ? i - Math.min(i, toRemove)
                                                      : i - Math.min(i, toRemove - Math.min(influence[players[p].opposite], toRemove))
                                                  );
                                                }),
                                              },
                                              phase: gameState.phase,  // typescript sure is silly sometimes ain't it
                                            });
                                          }

                                        } else if (
                                          gameState.phase.phase === "start"
                                          && !gameState.phase.focus.hasValue
                                          && gameState.phase.turn == player.id
                                        ) {
                                          const phase = gameState.phase;
                                          startEventAndSetGameState(
                                            {
                                              ...gameState,
                                              phase: gameState.phase,
                                              board: {
                                                ...gameState.board,
                                                kept: withMap2(gameState.board.kept, player.id, pKept => pKept.filter(k => k != event)),
                                              },
                                            },
                                            eventPhase => ({
                                              ...phase,
                                              ...eventPhase,
                                              phase: "event turn event",
                                            }),
                                            event
                                          );

                                        } else if (
                                          gameState.phase.phase === "score turn kept event deciding"
                                          && gameState.phase.action === player.id
                                        ) {
                                          const lastHistory = history.get(-1);
                                          if (
                                            lastHistory.hasValue
                                            && lastHistory.value.type === "score"
                                          ) {
                                            setHistory(history.slice(0, history.length - 1).concat([{
                                              ...lastHistory.value,
                                              events: with2(lastHistory.value.events, gameState.phase.action, opt(event)),
                                            }]));
                                          }

                                          const phase = gameState.phase;
                                          startEventAndSetGameState(
                                            {
                                              ...gameState,
                                              phase: gameState.phase,
                                              board: {
                                                ...gameState.board,
                                                kept: withMap2(gameState.board.kept, player.id, pKept => pKept.filter(k => k != event)),
                                              },
                                            },
                                            eventPhase => ({
                                              ...phase,
                                              ...eventPhase,
                                              phase: "score turn kept event",
                                            }),
                                            event
                                          );

                                        } else if (
                                          gameState.phase.phase === "ap turn initiative event"
                                          || gameState.phase.phase === "event turn event"
                                          || gameState.phase.phase === "score turn kept event"
                                        ) {
                                          const action =
                                            gameState.phase.phase === "ap turn initiative event"
                                              ? players[gameState.phase.turn].opposite
                                              : gameState.phase.phase === "event turn event"
                                                ? gameState.phase.turn
                                                : satisfiesCheck<"score turn kept event">(gameState.phase.phase)(gameState.phase.action);
                                          if (
                                            gameState.phase.focus === EventId.Assassin
                                            && gameState.phase.assassinAction === player.id
                                          ) {
                                            const board: typeof gameState.board = {
                                              ...gameState.board,
                                              kept: withMap2(gameState.board.kept, player.id, kept => kept.filter(e => e != event))
                                            }
                                            if (
                                              gameState.phase.assassinAction == action
                                              && gameState.board.kept[players[action].opposite].length > 0
                                            ) {
                                              setGameState({
                                                ...gameState,
                                                board,
                                                phase: {
                                                  ...gameState.phase,
                                                  assassinAction: players[action].opposite,
                                                },
                                              });
                                            } else {
                                              endEventAndSetGameState({
                                                ...gameState,
                                                board,
                                                phase: gameState.phase,
                                              });
                                            }
                                          }
                                        }
                                      }}
                                    >
                                      {eventCardKeptDivs[event]}
                                    </div>
                                  </div>)
                              }
                            </div>
                          </div>
                        )
                      }
                    </motion.div>,

                    ...gameState.board.cardTrack.map((card, iTrack) => {
                      const side =
                        (
                          (
                            gameState.phase.phase === "game over"
                            || gameState.phase.turn === 0
                          )
                          === (iTrack % 2 === 1)
                          === (gameState.board.cardTrack.length === TRACK_COUNT)
                        )
                          ? "left"
                          : "right";

                      return <motion.div  // track card
                        key={card.type === CardType.Score ? `score track ${iTrack}` : `event ${card.event}`}
                        layout="position"
                        layoutId={card.type === CardType.Score ? `score track ${iTrack}` : `event ${card.event}`}
                        transition={motionTransition}
                        style={{
                          width: "100%",
                          marginTop: iTrack === 0 ? `calc(1dvw + ${trackHeight} / 2)` : "1dvw",
                          height:
                            iTrack % 2 == 1
                              ? `calc(${trackHeight} * ${sharedTrackSpacing})`
                              : `calc(${trackHeight} * ${1 - sharedTrackSpacing})`,
                          minHeight: 0,
                          position: "relative",
                          zIndex: 2,
                        }}
                      >
                        <motion.div // dot
                          layout
                          transition={motionTransition}
                          style={{
                            width: `0.6dvh`,
                            height: `0.6dvh`,
                            position: "absolute",
                            left: "50%",
                            top: "0%",
                            x: "-50%",
                            y: "-50%",
                            backgroundColor: card.type === CardType.Score ? "gold" : "LightGray",
                            border: `0.2dvh solid ${borderColor}`,
                            borderRadius: "50%",
                          }}
                        />
                        <motion.div // card box
                          layout
                          transition={motionTransition}
                          style={{
                            width: "50%",
                            position: "absolute",
                            left: (side === "left") ? "0%" : "50%",
                            y: "-50%",
                            paddingLeft: "1dvw",
                            paddingRight: "1dvw",
                            boxSizing: "border-box",
                          }}>
                          <div // border
                            style={{
                              position: "relative",
                              border: "0.3dvw solid black",
                            }}
                            onClick={() => {
                              if (
                                gameState.phase.phase === "start"
                                && !gameState.phase.focus.hasValue
                                && gameState.board.cp[gameState.phase.turn] >= (trackCost[iTrack] ?? 0)
                              ) {
                                const board: typeof gameState.board = {
                                  ...gameState.board,
                                  cp: withMap2(gameState.board.cp, gameState.phase.turn, (cp) => cp - (trackCost[iTrack] ?? 0)),
                                  cardTrack: gameState.board.cardTrack.slice(0, iTrack).concat(gameState.board.cardTrack.slice(iTrack + 1)),
                                };
                                if (card.type === CardType.Event) {
                                  setGameState({
                                    ...gameState,
                                    board,
                                    phase: {
                                      ...gameState.phase,
                                      phase: "start",
                                      focus: opt(card.event),
                                    },
                                  });
                                } else {
                                  setGameState({
                                    ...gameState,
                                    board,
                                    phase: {
                                      ...gameState.phase,
                                      phase: "score turn deciding sector",
                                    },
                                  });
                                }
                              }
                            }}
                          >
                            <div style={{ // arrow
                              width: "0.25dvw",
                              height: "0.25dvw",
                              position: "absolute",
                              top: "50%",
                              ...(
                                (side === "left")
                                  ? {
                                    right: 0,
                                    transform: `translate(calc(0.3dvw + 50%), -50%) rotate(45deg)`,
                                  }
                                  : {
                                    left: 0,
                                    transform: `translate(calc(-0.3dvw - 50%), -50%) rotate(calc(45deg - 180deg))`,
                                  }
                              ),
                              borderTop: "0.3dvw solid black",
                              borderRight: "0.3dvw solid black",
                            }} />
                            { // content
                              card.type === CardType.Score
                                ? <div style={{ fontSize: 32, width: 200 }}>Score</div>
                                : eventCardDivs[card.event]
                            }
                          </div>
                        </motion.div>
                      </motion.div>;
                    }),
                  ]
                }
              </>;
            })()
          }
        </div>
      </div>
      <div style={{ flex: 3, textAlign: "center", height: "100%", alignContent: "center" }}>
        <div>
          <span style={{ fontSize: 20 }}>{phaseInstructions}</span>
        </div>
        <div>
          <table style={{ display: "inline-block", verticalAlign: "top" }}><tbody>
            <tr>
              {
                sectors.map(s =>
                  <td
                    key={s.id}
                    style={{ fontSize: 32, border: "thick solid gray" }}
                    colSpan={orbitals.filter(o => bands[o.band]?.sector == s.id).length}
                    onClick={() => { clickSector(s.id); }}
                  >
                    {s.name}
                  </td>
                )
              }
            </tr>
            <tr>
              {
                orbitals.map(o =>
                  <td
                    key={o.id}
                    style={{ fontSize: 24, border: "thick solid gray" }}
                    onClick={() => {
                      clickOrbital(o.id);
                    }}
                  >
                    {o.name}
                  </td>
                )
              }
            </tr>
            <tr>
              {
                gameState.board.fleets.map((oFleets, orbital) =>
                  <td
                    key={orbital}
                    style={{
                      border:
                        (oFleets[0] > oFleets[1])
                          ? "2px dotted red"
                          : (oFleets[1] > oFleets[0])
                            ? "2px dotted blue"
                            : "2px dotted gray",
                    }}
                    onClick={() => {
                      clickOrbital(orbital);
                    }}
                  >
                    {
                      players.map(player =>
                        <span key={player.id}>
                          {
                            Array(oFleets[player.id]).fill(false).map((_, iFleet) =>
                              <span
                                key={iFleet}
                                style={(() => {
                                  if (
                                    (
                                      (
                                        (
                                          gameState.phase.phase === "ap turn ap"
                                          && gameState.phase.turn === player.id
                                        )
                                        || (
                                          (
                                            gameState.phase.phase === "ap turn initiative event"
                                            || gameState.phase.phase === "event turn event"
                                            || gameState.phase.phase === "score turn kept event"
                                          )
                                          && (
                                            gameState.phase.focus === EventId.HeavyBurn
                                            || gameState.phase.focus === EventId.AdmiralSouther
                                          )
                                          && (
                                            player.id == (
                                              gameState.phase.phase === "ap turn initiative event"
                                                ? players[gameState.phase.turn].opposite
                                                : gameState.phase.phase === "event turn event"
                                                  ? gameState.phase.turn
                                                  : satisfiesCheck<"score turn kept event">(gameState.phase.phase)(gameState.phase.action)
                                            )
                                          )
                                        )
                                      )
                                      && gameState.phase.selectedFleetGroup.hasValue
                                      && gameState.phase.selectedFleetGroup.value.orbital == orbital
                                      && iFleet < gameState.phase.selectedFleetGroup.value.count
                                    )
                                    || (
                                      (
                                        gameState.phase.phase === "ap turn initiative event"
                                        || gameState.phase.phase === "event turn event"
                                        || gameState.phase.phase === "score turn kept event"
                                      )
                                      && (
                                        (
                                          (
                                            gameState.phase.focus === EventId.StealthShips
                                            || gameState.phase.focus === EventId.Razorback
                                          )
                                          && iFleet == 0
                                          && gameState.phase.selectedFleet.hasValue
                                          && gameState.phase.selectedFleet.value === orbital
                                          && player.id === (
                                            gameState.phase.phase === "ap turn initiative event"
                                              ? players[gameState.phase.turn].opposite
                                              : gameState.phase.phase === "event turn event"
                                                ? gameState.phase.turn
                                                : satisfiesCheck<"score turn kept event">(gameState.phase.phase)(gameState.phase.action)
                                          )
                                        )
                                      )
                                    )
                                  ) {
                                    return { background: "yellow" };
                                  }
                                  return undefined;
                                })()}
                                onClick={() => {
                                  if (
                                    gameState.phase.phase === "ap turn ap"
                                    && gameState.phase.turn === player.id
                                    && !gameState.phase.selectedFleetGroup.hasValue
                                  ) {
                                    setGameState({
                                      ...gameState,
                                      phase: {
                                        ...gameState.phase,
                                        selectedFleetGroup: opt({
                                          orbital,
                                          count: iFleet + 1,
                                        }),
                                      },
                                    });

                                  } else if (
                                    gameState.phase.phase === "ap turn initiative event"
                                    || gameState.phase.phase === "event turn event"
                                    || gameState.phase.phase === "score turn kept event"
                                  ) {

                                    const action =
                                      gameState.phase.phase === "ap turn initiative event"
                                        ? players[gameState.phase.turn].opposite
                                        : gameState.phase.phase === "event turn event"
                                          ? gameState.phase.turn
                                          : satisfiesCheck<"score turn kept event">(gameState.phase.phase)(gameState.phase.action);

                                    if (gameState.phase.focus === EventId.TheresaYao) {
                                      if (player.id == action) return;

                                      const toRemove = map2(oFleets, (f, removePlayer) =>
                                        Math.min(f, Math.max(0, iFleet + 1 + (removePlayer == action ? -1 : 0))));
                                      if ((toRemove[action] ?? 0) + 1 != toRemove[players[action].opposite]) return;

                                      endEventAndSetGameState({
                                        ...gameState,
                                        phase: gameState.phase,
                                        board: {
                                          ...gameState.board,
                                          fleets: gameState.board.fleets.with(orbital, [oFleets[0] - toRemove[0], oFleets[1] - toRemove[1]]),
                                        },
                                      });

                                    } else if (gameState.phase.focus === EventId.Ambush) {
                                      if (gameState.phase.removed.hasValue && player.id == gameState.phase.removed.value.player) return;

                                      (gameState.phase.removed.hasValue ? endEventAndSetGameState : setGameState)({
                                        ...gameState,
                                        phase: {
                                          ...gameState.phase,
                                          removed: opt({ orbital, player: player.id }),
                                        },
                                        board: {
                                          ...gameState.board,
                                          fleets: gameState.board.fleets.with(orbital, withMap2(oFleets, player.id, f => f - 1)),
                                        },
                                      });

                                    } else if (gameState.phase.focus === EventId.StealthShips) {
                                      if (gameState.phase.selectedFleet.hasValue) {
                                        if (player.id == action) return;
                                        if (iFleet >= 3) return;
                                        if (Math.abs((orbitals[orbital]?.band ?? 0) - (orbitals[gameState.phase.selectedFleet.value]?.band ?? 0)) > 1) return;
                                        if (gameState.board.fleets[orbital]?.[players[action].opposite] == 0) return;

                                        endEventAndSetGameState({
                                          ...gameState,
                                          phase: gameState.phase,
                                          board: {
                                            ...gameState.board,
                                            fleets:
                                              gameState.board.fleets
                                                .withMap(gameState.phase.selectedFleet.value, oFleets => withMap2(oFleets, action, f => f - 1))
                                                .with(orbital, withMap2(oFleets, players[action].opposite, f => f - iFleet - 1)),
                                          },
                                        });

                                      } else {
                                        if (player.id != action) return;
                                        if (orbitals.some(targetOrbital =>
                                          Math.abs(targetOrbital.band - (orbitals[orbital]?.band ?? 0)) <= 1
                                          && (gameState.board.fleets[targetOrbital.id]?.[players[action].opposite] ?? 0) > 0
                                        ) === false) return;

                                        setGameState({
                                          ...gameState,
                                          phase: {
                                            ...gameState.phase,
                                            selectedFleet: opt(orbital),
                                          },
                                        });

                                      }

                                    } else if (
                                      gameState.phase.focus === EventId.HeavyBurn
                                      || gameState.phase.focus === EventId.AdmiralSouther
                                    ) {
                                      if (
                                        action === player.id
                                        && !gameState.phase.selectedFleetGroup.hasValue
                                        && (gameState.phase.fleetsPermitted[orbital] ?? 0) >= (iFleet + 1)
                                      ) {
                                        setGameState({
                                          ...gameState,
                                          phase: {
                                            ...gameState.phase,
                                            selectedFleetGroup: opt({
                                              orbital,
                                              count: iFleet + 1,
                                            }),
                                          },
                                        });
                                      }

                                    }

                                  }
                                }}
                              >
                                {player.id === PlayerId.MCR ? "🚀" : "🛸"}
                              </span>
                            )
                          }
                          {
                            player.homeOrbital == orbital
                              ? <button
                                style={{
                                  display:
                                    (
                                      gameState.phase.phase === "ap turn ap"
                                      && player.id === gameState.phase.turn
                                      && gameState.phase.selectedFleetGroup.hasValue === false
                                      && gameState.board.fleets.map(oFleets => oFleets[player.id]).reduce((a, b) => a + b) < FLEET_COUNT
                                    ) // TODO ap events
                                      ? "inline"
                                      : "none",
                                }}
                                onClick={() => {
                                  if (
                                    gameState.phase.phase === "ap turn ap"
                                    && gameState.phase.selectedFleetGroup.hasValue === false
                                  ) {
                                    reduceApAndSetGameState({
                                      ...gameState,
                                      board: {
                                        ...gameState.board,
                                        fleets: gameState.board.fleets.withMap(
                                          orbital,
                                          oFleets => withMap2(oFleets, player.id, f => f + 1)
                                        ),
                                      },
                                    });
                                  }
                                }}
                              >
                                +
                              </button>
                              : undefined
                          }
                          {player.id == players.length - 1 ? undefined : <span style={{ fontSize: 8 }}>{oFleets[0] != 0 && oFleets[1] != 0 ? "💥" : ""}</span>}
                        </span>)
                    }
                  </td>
                )
              }
            </tr>
            {
              [
                [
                  opt(BaseId.Eurasia), opt(BaseId.MarinerValley), opt(BaseId.Ceres), opt(BaseId.Tycho),
                  opt(BaseId.Eros), opt(BaseId.Thoth), opt(BaseId.Europa), opt(BaseId.Rhea),
                ],
                [
                  opt(BaseId.Africa), opt(BaseId.LondresNova), nullopt, nullopt,
                  nullopt, nullopt, opt(BaseId.Ganymede), opt(BaseId.Titan),
                ],
              ]
                .map((row, iRow) =>
                  <tr key={iRow}>
                    {
                      row.map((b, iCol) => {
                        if (!b.hasValue) return <td key={iCol} />;
                        const base = bases[b.value];
                        const fleets = gameState.board.fleets[base?.orbital ?? 0];
                        const influence = gameState.board.influence[b.value];
                        if (base === undefined || fleets === undefined || influence === undefined) return <td key={iCol} />;

                        const orbitalControlBonus = map2(players, p => fleets[p.id] > fleets[p.opposite] && influence[p.id] != 0 ? 1 : 0);
                        const power = map2(orbitalControlBonus, (bonus, p) => influence[p] + bonus);

                        return <td
                          key={iCol}
                          style={{
                            border:
                              (power[0] > power[1])
                                ? "medium dashed red"
                                : (power[1] > power[0])
                                  ? "medium dashed blue"
                                  : "medium dashed gray",
                            verticalAlign: "top",
                          }}
                          onClick={() => {
                            clickBase(b.value);
                          }}
                        >
                          <div style={{ fontSize: 16 }}>{base.name}</div>
                          <div>
                            {
                              players.map(player =>
                                <span key={player.id}>
                                  {
                                    Array(influence[player.id]).fill(false).map((_, iInfluence) =>
                                      <span
                                        key={iInfluence}
                                        style={(() => {
                                          if (
                                            (
                                              gameState.phase.phase === "ap turn initiative event"
                                              || gameState.phase.phase === "event turn event"
                                              || gameState.phase.phase === "score turn kept event"
                                            )
                                            && gameState.phase.focus === EventId.CovertOp
                                            && gameState.phase.selectedInfluence.hasValue
                                            && gameState.phase.selectedInfluence.value.base === base.id
                                            && gameState.phase.selectedInfluence.value.player === player.id
                                            && iInfluence == 0
                                          ) {
                                            return { background: "yellow" };
                                          }
                                          return undefined;
                                        })()}
                                        onClick={() => {
                                          if (
                                            (
                                              gameState.phase.phase === "ap turn initiative event"
                                              || gameState.phase.phase === "event turn event"
                                              || gameState.phase.phase === "score turn kept event"
                                            )
                                            && gameState.phase.focus === EventId.CovertOp
                                          ) {
                                            if (
                                              gameState.phase.selectedInfluence.hasValue
                                              && gameState.phase.selectedInfluence.value.player != player.id
                                            ) {
                                              const selectedInfluence = gameState.phase.selectedInfluence;
                                              endEventAndSetGameState({
                                                ...gameState,
                                                phase: gameState.phase,
                                                board: {
                                                  ...gameState.board,
                                                  influence:
                                                    gameState.board.influence
                                                      .withMap(gameState.phase.selectedInfluence.value.base, influence =>
                                                        withMap2(
                                                          withMap2(
                                                            influence,
                                                            selectedInfluence.value.player,
                                                            i => i - 1
                                                          ),
                                                          player.id,
                                                          i => i + 1
                                                        )
                                                      )
                                                      .withMap(base.id, influence =>
                                                        withMap2(
                                                          withMap2(
                                                            influence,
                                                            selectedInfluence.value.player,
                                                            i => i + 1
                                                          ),
                                                          player.id,
                                                          i => i - 1
                                                        )
                                                      ),
                                                },
                                              });
                                            } else if (!gameState.phase.selectedInfluence.hasValue) {
                                              setGameState({
                                                ...gameState,
                                                phase: {
                                                  ...gameState.phase,
                                                  selectedInfluence: opt({
                                                    base: base.id,
                                                    player: player.id,
                                                  }),
                                                },
                                              });
                                            }
                                          }
                                        }}
                                      >
                                        {player.id === PlayerId.MCR ? "🎴" : "🌐"}
                                      </span>
                                    )
                                  }
                                  <span>{"🪐".repeat(orbitalControlBonus[player.id])}</span>
                                  {player.id == players.length - 1 ? undefined : <span style={{ fontSize: 8 }}>{power[0] != 0 && power[1] != 0 ? "⚔️" : ""}</span>}
                                </span>)
                            }
                          </div>
                        </td>
                      })
                    }
                  </tr>
                )
            }
          </tbody></table>
        </div>
      </div>
    </div >
  );
}