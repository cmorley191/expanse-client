import "../core/array_extensions";

import * as React from "react";
import { motion, Transition } from "motion/react";

import { bands, BaseId, bases, Card, CardType, EventId, events, NONSCORES_PER_PILE, orbitals, PILES, PlayerId, players, SCORES_PER_PILE, sectors, TRACK_COUNT } from "../game/parameters";
import { GameState, GameStateContinuation, getContinuations, TurnHistoryItem } from "../game/state";
import { getRandomInt, lerp, map2, satisfiesCheck } from "../core/misc";
import { nullopt, opt, Optional, optMap, throwOnNullopt } from "../core/optional";


type AppProps = {};

export default function App({ }: AppProps) {
  const [gameState, setGameStateRaw] = React.useState<GameState>(() => {
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

  const continuations = getContinuations(gameState);

  const [turnHistory, setTurnHistory] = React.useState<TurnHistoryItem[]>([]);

  function setGameState(continuation: GameStateContinuation) {
    setTurnHistory(turnHistory.concat(continuation.turnsComplete));
    setGameStateRaw(continuation.state);
  }

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
              const totalHistoryFlex = lerp(0, maxHistoryFlex, Math.pow(turnHistory.length / maxHistoryLength, 0.8));
              const historyFlexes = (() => {
                if (turnHistory.length === 0) return [];
                const unnormalized = turnHistory.map((_, iHistory) =>
                  Math.pow(
                    1 - ((turnHistory.length - iHistory) / maxHistoryLength),
                    lerp(1, 3, Math.pow(turnHistory.length / maxHistoryLength, 0.2))
                  ));
                const totalUnnormalized = unnormalized.reduce((a, b) => a + b);
                const minPerHistory = 0.7 / maxHistoryLength;
                return unnormalized.map(x => minPerHistory + x * totalHistoryFlex / Math.max(0.01, totalUnnormalized - minPerHistory * turnHistory.length));
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
                    ...turnHistory.map((historyItem, iHistory) => {
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
                        id={key}
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
                        if (focus.value.type === CardType.Score) return `score ${turnHistory.length}`;
                        const focusValue = focus.value;
                        if (turnHistory.some(h => h.card.type === CardType.Event && h.card.event === focusValue.event)) return `kept ${turnHistory.length}`;
                        return `event ${focus.value.event}`;
                      })();

                      return [<motion.div
                        key={key}
                        layout="position"
                        layoutId={key}
                        transition={motionTransition}
                        id={key}
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
                                new Date(new Date().getFullYear() + 300, 0, 1 + (turnHistory.length / maxHistoryLength) * 366)
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
                            continuations.actions.clickUseAP.hasValue
                            || continuations.actions.clickUseEvent.hasValue
                            || continuations.actions.clickKeepEvent.hasValue
                            || continuations.actions.clickPass.hasValue
                          )
                            ? "flex"
                            : "none"
                      }}>
                        {
                          [
                            { text: "Use AP", continuations: continuations.actions.clickUseAP },
                            { text: "Use Event", continuations: continuations.actions.clickUseEvent },
                            { text: "Keep Event", continuations: continuations.actions.clickKeepEvent },
                            { text: "Pass", continuations: continuations.actions.clickPass },
                          ]
                            .map(b =>
                              <button
                                key={b.text}
                                disabled={b.continuations.hasValue === false}
                                onClick={() => {
                                  if (b.continuations.hasValue) {
                                    setGameState(b.continuations.value);
                                  }
                                }}
                              >
                                {b.text}
                              </button>)
                        }
                      </div>
                    </motion.div>,

                    <motion.div // players
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
                                    : (continuations.actions.clickKeptCard[player.id]?.some(c => c.hasValue) === true)
                                      ? {
                                        maxHeight: `calc(${trackHeight} * 1.25)`,
                                        marginBottom: "1dvw",
                                        maskImage: "linear-gradient(to bottom, black 80%, transparent 100%)",
                                      }
                                      : {
                                        maxHeight: `calc(${trackHeight} * 0.25)`,
                                        marginBottom: 0,
                                        maskImage: "linear-gradient(to bottom, black 0%, transparent 100%)",
                                      }
                                ),
                                gridArea: "keptList",
                                overflowY:
                                  (continuations.actions.clickKeptCard[player.id]?.some(c => c.hasValue) === true) ? "scroll" : "clip",
                              }}>
                              {
                                gameState.board.kept[player.id]
                                  .takeZip((continuations.actions.clickKeptCard[player.id] ?? []).padRight({ toLength: gameState.board.kept[player.id].length, getPadElement: () => nullopt }))
                                  .map(([event, continuations]) =>
                                    <div  // kept card
                                      key={event}
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
                                          if (continuations.hasValue) {
                                            setGameState(continuations.value);
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

                    ...gameState.board.cardTrack
                      .takeZip(continuations.actions.clickTrackCard)
                      .map(([card, continuations], iTrack) => {
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

                        const key = card.type === CardType.Score ? `score track ${iTrack}` : `event ${card.event}`

                        return <motion.div  // track card
                          key={key}
                          layout="position"
                          layoutId={key}
                          transition={motionTransition}
                          id={key}
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
                                if (continuations.hasValue) {
                                  setGameState(continuations.value);
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
          <span style={{ fontSize: 20 }}>{continuations.instructions}</span>
        </div>
        <div>
          <table style={{ display: "inline-block", verticalAlign: "top" }}><tbody>
            <tr>
              {
                throwOnNullopt(sectors.zip(continuations.actions.clickSector), "bad continuations").map(([s, continuations]) =>
                  <td
                    key={s.id}
                    style={{ fontSize: 32, border: "thick solid gray" }}
                    colSpan={orbitals.filter(o => bands[o.band]?.sector == s.id).length}
                    onClick={() => {
                      if (continuations.hasValue) {
                        setGameState(continuations.value);
                      }
                    }}
                  >
                    {s.name}
                  </td>
                )
              }
            </tr>
            <tr>
              {
                throwOnNullopt(orbitals.zip(continuations.actions.clickOrbital), "bad continuations").map(([o, continuations]) =>
                  <td
                    key={o.id}
                    style={{ fontSize: 24, border: "thick solid gray" }}
                    onClick={() => {
                      if (continuations.hasValue) {
                        setGameState(continuations.value);
                      }
                    }}
                  >
                    {o.name}
                  </td>
                )
              }
            </tr>
            <tr>
              {
                gameState.board.fleets
                  .takeZip(continuations.actions.clickOrbital)
                  .takeZip(continuations.actions.clickFleet)
                  .map(([[oFleets, orbitalContinuations], orbitalFleetContinuations], orbital) =>
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
                        if (orbitalContinuations.hasValue) {
                          setGameState(orbitalContinuations.value);
                        }
                      }}
                    >
                      {
                        players.takeZip(continuations.actions.clickBuildFleet).map(([player, buildContinuations]) =>
                          <span key={player.id}>
                            {
                              (orbitalFleetContinuations[player.id] ?? []).padRight({ toLength: oFleets[player.id], getPadElement: () => nullopt })
                                .map((fleetContinuations, iFleet) =>
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
                                                gameState.phase.focus === EventId.Drummer
                                                || gameState.phase.focus === EventId.Cotyar
                                                || gameState.phase.focus === EventId.HeavyBurn
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
                                              gameState.phase.focus === EventId.Razorback
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
                                      if (fleetContinuations.hasValue) {
                                        setGameState(fleetContinuations.value);
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
                                  style={{ display: buildContinuations.hasValue ? "inline" : "none" }}
                                  onClick={() => {
                                    if (buildContinuations.hasValue) {
                                      setGameState(buildContinuations.value);
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
                        const baseContinuations = continuations.actions.clickBase[b.value];
                        const baseInfluenceContinuations = continuations.actions.clickInfluence[b.value];
                        const fleets = gameState.board.fleets[base?.orbital ?? 0];
                        const influence = gameState.board.influence[b.value];
                        if (
                          base === undefined
                          || baseContinuations === undefined
                          || baseInfluenceContinuations === undefined
                          || fleets === undefined
                          || influence === undefined
                        ) return <td key={iCol} />;

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
                            if (baseContinuations.hasValue) {
                              setGameState(baseContinuations.value);
                            }
                          }}
                        >
                          <div style={{ fontSize: 16 }}>{base.name}</div>
                          <div>
                            {
                              players.map(player =>
                                <span key={player.id}>
                                  {
                                    (baseInfluenceContinuations[player.id] ?? []).padRight({ toLength: influence[player.id], getPadElement: () => nullopt })
                                      .map((influenceContinuations, iInfluence) =>
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
                                            if (influenceContinuations.hasValue) {
                                              setGameState(influenceContinuations.value);
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