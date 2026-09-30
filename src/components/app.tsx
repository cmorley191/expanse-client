import "../core/array_extensions";

import * as React from "react";
import { BandId, bands, BaseId, bases, Card, CardType, EventId, events, FLEET_COUNT, GameState, GameStateAPPhase, GameStateEventPhase, NONSCORES_PER_PILE, OrbitalId, orbitals, PILES, PlayerId, players, resources, SCORES_PER_PILE, sectors, TRACK_COUNT, trackCost } from "../game/game_types";
import { assertType, getRandomInt, map2, withMap2 } from "../core/misc";
import { nullopt, opt, optValueOr } from "../core/optional";


type AppProps = {};

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
      },
    };
  });

  const phaseInstructions = ((): string => {
    if (gameState.phase.phase === "game over") return "Game over!";


    if (gameState.phase.phase === "start") {
      if (gameState.phase.focus.hasValue) return `${players[gameState.phase.turn]?.name}, choose what to do with the selected card.`;
      else return `${players[gameState.phase.turn]?.name}, choose a kept card or a track card.`;
    }
    // mao-kwik
    // ap later
    if (gameState.phase.phase === "ap turn initiative deciding") return `${players[players[gameState.phase.turn]?.opposite ?? 0]?.name}, choose what to do with the other player's event card.`;
    // events later
    if (gameState.phase.phase === "score turn deciding sector") return `${players[gameState.phase.turn]?.name}, choose a sector to receive bonus scoring.`;
    if (gameState.phase.phase === "score turn kept event deciding") return `${players[gameState.phase.action]?.name}, you may use a kept event before the bonus sector is revealed, if you wish.`;

    const phase: (
      | { phase: "mao-kwik of some kind" }
      | { phase: "ap of some kind", apPhase: GameStateAPPhase }
      | {
        phase:
        | "ap turn initiative event"
        | "event turn event"
        | "score turn kept event",
        eventPhase: GameStateEventPhase,
        action: PlayerId,
      }
    ) = (() => {
      if (gameState.phase.phase === "ap turn deciding mao-kwik") return {
        phase: "mao-kwik of some kind",
      };

      if (gameState.phase.phase === "ap turn ap") return {
        phase: "ap of some kind",
        apPhase: gameState.phase,
      };

      assertType<
        | "ap turn initiative event"
        | "event turn event"
        | "score turn kept event"
      >(gameState.phase.phase);

      const eventPhase: GameStateEventPhase =
        (
          gameState.phase.focus === EventId.Miller
          && gameState.phase.target.hasValue
          && gameState.phase.target.value.phase === "event"
        )
          ? gameState.phase.target.value
          : gameState.phase;

      if (
        eventPhase.focus === EventId.Drummer
        || eventPhase.focus === EventId.Cotyar
      ) return {
        phase: "ap of some kind",
        apPhase: eventPhase,
      };

      if (
        eventPhase.focus === EventId.Miller
        && eventPhase.target.hasValue
        && eventPhase.target.value.phase === "deciding mao-kwik"
      ) return {
        phase: "mao-kwik of some kind",
      };

      if (
        eventPhase.focus === EventId.Miller
        && eventPhase.target.hasValue
        && eventPhase.target.value.phase === "ap"
      ) return {
        phase: "ap of some kind",
        apPhase: eventPhase.target.value,
      };

      if (
        eventPhase.focus === EventId.TheHybrid
        && eventPhase.selected.hasValue
      ) return {
        phase: "mao-kwik of some kind",
      };

      return {
        phase: gameState.phase.phase,
        eventPhase,
        action:
          gameState.phase.phase === "score turn kept event"
            ? gameState.phase.action
            : gameState.phase.turn,
      };
    })();

    if (phase.phase === "mao-kwik of some kind") {
      return `${players[gameState.phase.turn]?.name}, choose whether to use the card's AP, or 4 AP from kept Mao-Kwikowski Mercantile.`;
    }

    if (phase.phase === "ap of some kind") {
      return `${players[gameState.phase.turn]?.name}, you have ${phase.apPhase.ap} AP remaining. ` + (() => {
        if (phase.apPhase.selectedFleetGroup.hasValue) return "Select a destination for the selected fleets.";
        else return "Build a fleet, place an influence, or select a group of your fleets to move.";
      })();
    }

    const eventPhase = phase.eventPhase;
    if (
      eventPhase.focus === EventId.Drummer
      || eventPhase.focus === EventId.Cotyar
    ) throw `should've been handled above`;

    if (eventPhase.focus === EventId.Miller) {
      if (!eventPhase.target.hasValue) return `${players[phase.action]?.name}, select a card to perform.`;
      assertType<
        | "deciding mao-kwik"
        | "ap"
        | "event"
      >(eventPhase.target.value.phase);
      throw `should've been handled above`;
    }

    if (eventPhase.focus === EventId.Assassin) return `${players[eventPhase.action]}, select a kept card to discard.`;
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
      if (eventPhase.selectedFleetGroup.hasValue) return `${players[phase.action]?.name}, select fleet(s) to attack.`;
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
    else return `${players[phase.action]?.name}, you may move ${eventPhase.remainingFleets} more un-moved fleets.`;
  })();

  const eventCardDivs = events.map(event =>
    <div style={{ width: "200px" }}>
      <div style={{ fontSize: 24 }}>{event.title}</div>
      <div>{optValueOr(event.subtitle, undefined)}</div>
      <div>{event.ap} AP</div>
      <div style={{
        border:
          (event.factions.filter(x => x).length != 1)
            ? "medium dashed magenta"
            : (event.factions[0])
              ? "medium dashed red"
              : "medium dashed blue",
      }}>
        <div>
          {event.factions[0] ? "🎴" : undefined}
          {event.factions[1] ? "🌐" : undefined}
          {event.text}
        </div>
        {event.modelImplemented ? undefined : <div style={{ fontSize: 8 }}>(not implemented in model)</div>}
      </div>
    </div>
  );

  function drawAndSetGameState(newState: GameState) {
    const card = newState.board.deck[0]
    if (card === undefined || newState.board.deck.slice(1).some(c => c.type === CardType.Score) === false) {
      setGameState({
        ...newState,
        phase: { phase: "game over" },
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
    if (
      newState.phase.phase === "ap turn ap"
    ) {
      if (newState.phase.ap === 1) {
        if (events[newState.phase.focus]?.factions[players[newState.phase.turn].opposite]) {
          setGameState({
            ...newState,
            phase: {
              ...newState.phase,
              phase: "ap turn initiative deciding",
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
    }
  }

  function clickOrbital(orbital: OrbitalId) {
    if (
      gameState.phase.phase === "ap turn ap"
      && gameState.phase.selectedFleetGroup.hasValue
    ) {
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
    }
  }

  return (
    <div style={{ textAlign: "center", userSelect: "none", cursor: "default" }}>
      <div>
        <span style={{ fontSize: 20 }}>{phaseInstructions}</span>
      </div>
      <div>
        <div>
          <table style={{ display: "inline-block", verticalAlign: "top" }}><tbody>
            <tr>
              {
                sectors.map(s =>
                  <td
                    key={s.id}
                    style={{ fontSize: 32, border: "thick solid gray" }}
                    colSpan={orbitals.filter(o => bands[o.band]?.sector == s.id).length}
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
                                    gameState.phase.phase === "ap turn ap"
                                    && gameState.phase.turn === player.id
                                    && gameState.phase.selectedFleetGroup.hasValue
                                    && gameState.phase.selectedFleetGroup.value.orbital == orbital
                                    && iFleet < gameState.phase.selectedFleetGroup.value.count
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
                                  }
                                }}
                              >
                                {player.id === PlayerId.MCR ? "🚀" : "🛰️"}
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
                                      && gameState.phase.selectedFleetGroup.hasValue === false
                                      && gameState.board.fleets.map(oFleets => oFleets[player.id]).reduce((a, b) => a + b) < FLEET_COUNT
                                    )
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
                            {"🎴".repeat(influence[0])}
                            {"🪐".repeat(orbitalControlBonus[0])}
                            <span style={{ fontSize: 8 }}>{power[0] != 0 && power[1] != 0 ? "⚔️" : ""}</span>
                            {"🌐".repeat(influence[1])}
                            {"🪐".repeat(orbitalControlBonus[1])}
                          </div>
                        </td>
                      })
                    }
                  </tr>
                )
            }
          </tbody></table>
          <div style={{ display: "inline-block", verticalAlign: "top" }}>
            <div style={{
              display:
                (
                  (gameState.phase.phase === "start" && gameState.phase.focus.hasValue)
                  || (gameState.phase.phase === "ap turn initiative deciding")
                )
                  ? "flex"
                  : "none"
            }}>
              <button
                disabled={gameState.phase.phase === "ap turn initiative deciding"}
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
                  }
                }}
              >
                Use AP
              </button>
              <button
                disabled={
                  gameState.phase.phase === "start"
                  && gameState.phase.focus.hasValue
                  && events[gameState.phase.focus.value]?.factions[gameState.phase.turn] === false
                }
                onClick={() => {
                  if (
                    gameState.phase.phase === "start"
                    && gameState.phase.focus.hasValue
                  ) {

                  }
                }}
              >
                Use Event
              </button>
              <button
                disabled={
                  (
                    gameState.phase.phase === "start"
                    && gameState.phase.focus.hasValue
                    && (
                      gameState.board.cp[gameState.phase.turn] < 1
                      || events[gameState.phase.focus.value]?.factions[gameState.phase.turn] === false
                    )
                  )
                  || (
                    gameState.phase.phase === "ap turn initiative deciding"
                    && gameState.board.cp[players[gameState.phase.turn].opposite] < 1
                  )
                }
                onClick={() => {
                  if (
                    gameState.phase.phase === "start"
                    && gameState.phase.focus.hasValue
                  ) {
                    const focus = gameState.phase.focus;
                    drawAndSetGameState({
                      ...gameState,
                      board: {
                        ...gameState.board,
                        cp: withMap2(gameState.board.cp, gameState.phase.turn, (cp) => cp - 1),
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
                    const phase = gameState.phase;
                    const player = players[gameState.phase.turn].opposite;
                    drawAndSetGameState({
                      ...gameState,
                      board: {
                        ...gameState.board,
                        cp: withMap2(gameState.board.cp, player, (cp) => cp - 1),
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
                disabled={gameState.phase.phase === "start"}
                onClick={() => {
                  if (gameState.phase.phase === "ap turn initiative deciding") {
                    drawAndSetGameState({
                      ...gameState,
                      phase: {
                        ...gameState.phase,
                        phase: "start",
                        turn: players[gameState.phase.turn].opposite,
                        focus: nullopt,
                      },
                    });
                  }
                }}
              >
                Pass
              </button>
            </div>
            <table><tbody><tr>
              {
                (() => {
                  if (
                    gameState.phase.phase === "score turn deciding sector"
                    || gameState.phase.phase === "score turn kept event deciding"
                    || gameState.phase.phase === "game over"
                  ) return undefined;
                  const eventOpt =
                    (gameState.phase.phase === "start")
                      ? gameState.phase.focus
                      : opt(gameState.phase.focus);
                  if (!eventOpt.hasValue) return undefined;
                  const event = eventOpt.value;
                  return (
                    <td
                      style={{
                        border: "thick solid black",
                        verticalAlign: "top",
                      }}
                    >
                      {eventCardDivs[event]}
                    </td>
                  );
                })()
              }
            </tr></tbody></table>
          </div>
        </div>
        <table><tbody><tr>
          {
            gameState.board.cardTrack.map((card, iTrack) =>
              <td
                key={iTrack}
                style={{
                  border: "thick solid black",
                  verticalAlign: "top",
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
                {
                  card.type === CardType.Score
                    ? <div style={{ fontSize: 32 }}>Score</div>
                    : eventCardDivs[card.event]
                }
              </td>
            )
          }
        </tr></tbody></table>
      </div>
    </div >
  );
}