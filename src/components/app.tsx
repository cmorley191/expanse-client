import "../core/array_extensions";

import * as React from "react";
import { HTMLMotionProps, motion, Transition } from "motion/react";

import { bands, BaseId, bases, Card, CardType, EventId, events, NONSCORES_PER_PILE, orbitals, PILES, PlayerId, players, SCORES_PER_PILE, sectors, TRACK_COUNT } from "../game/parameters";
import { GameState, GameStateContinuation, GameStateContinuations, TurnHistoryItem } from "../game/state";
import { assertType, getRandomInt, lerp, map2, satisfiesCheck, tuple2, unlerp } from "../core/misc";
import { nullopt, opt, Optional, optMap, optValueOr, throwOnNullopt } from "../core/optional";
import { ExpanseModel_Sirius, getStateContinuationsInputs } from "../game/model";
import AnimatedEllipses from "./elements/animated_ellipses";


type AppProps = {};

export default function App({ }: AppProps) {
  const [model, setModel] = React.useState<
    | { state: "loading" }
    | { state: "error", error: any }
    | { state: "loaded", model: ExpanseModel_Sirius }
  >({ state: "loading" });

  React.useEffect(() => {
    ExpanseModel_Sirius.initialize()
      .then(
        newModel => setModel({ state: "loaded", model: newModel }),
        error => setModel({ state: "error", error })
      );
  }, []);

  return (
    model.state === "loaded"
      ? <Game model={model.model} />
      : <div style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        textAlign: "center",
      }}>
        {
          model.state === "loading"
            ? <div style={{ fontSize: "4dvh", marginBottom: "2dvh" }}>Initializing AI model...</div>
            : <>
              <div style={{ fontSize: "4dvh", marginBottom: "2dvh" }}>Failed to load model!</div>
              <div style={{ fontSize: "1.5dvh" }}>{model.error.toString()}</div>
            </>
        }
        <div style={{ fontSize: "1dvh" }}>{ExpanseModel_Sirius.weightsPath}</div>
      </div>
  );
}


function useAnimationFrame(animationEffect: () => { callback: FrameRequestCallback, cleanup: () => void }, deps?: React.DependencyList) {
  React.useEffect(() => {
    const animationEffectResult = animationEffect();

    let animationFrameId: number = 0;

    const animate: FrameRequestCallback = (currentTimeMs) => {
      animationEffectResult.callback(currentTimeMs);
      animationFrameId = window.requestAnimationFrame(animate);
    };

    animationFrameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      animationEffectResult.cleanup();
    };
  }, deps);
}

function useLazyRef<T>(init: () => T) {
  const ref = React.useRef<Optional<T>>(nullopt);
  React.useEffect(() => { ref.current = opt(init()); }, []);
  return ref;
}


type CanvasProps =
  & HTMLMotionProps<"canvas">
  & { draw: (context: CanvasRenderingContext2D, currentTimeMs: number) => void }
  ;

export function Canvas({ draw, ...rest }: CanvasProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  useAnimationFrame(() => {
    const canvas = canvasRef.current;
    if (canvas === null) throw `null canvas`;

    const context = canvas.getContext('2d');
    if (context === null) throw `null context`;

    return {
      callback: (currentTimeMs) => {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        draw(context, currentTimeMs);
      },
      cleanup: () => { },
    };
  }, [draw]);

  return <motion.canvas ref={canvasRef} {...rest} />;
};

const radiusScale = 0.62;
const bodyMeta: {
  name: string,
  semiMajorAU: number,
  semiMinorAU: number,
  orbitRotationOffset: number,
  orbitStartOffset: number,
  important: boolean,
  render:
  & { radiusAU: number, imageName: string }
  & (
    | (
      & { periodD: number }
      & (
        { type: "sphere", nightImageName: Optional<string> }
        | { type: "plate" }
      )
    )
    | { type: "static", imageName: string }
  ),
}[] = [
    {
      name: "Mercury",
      semiMajorAU: 0.387,
      semiMinorAU: 0.378,
      orbitRotationOffset: 0.508,
      orbitStartOffset: 0.6,
      important: false,
      render: {
        radiusAU: 0.29 * radiusScale,
        type: "sphere",
        periodD: 58.65,
        imageName: "assets/image/Mercury_-_complete_mono_basemap_2500mpp_equirectangular.png",
        nightImageName: nullopt,
      },
    },
    {
      name: "Venus",
      semiMajorAU: 0.723,
      semiMinorAU: 0.722,
      orbitRotationOffset: 0.958,
      orbitStartOffset: 0.1,
      important: false,
      render: {
        radiusAU: 0.35 * radiusScale,
        type: "sphere",
        periodD: -243.02,
        imageName: "assets/image/Cylindrical_Map_of_Venus.jpg",
        nightImageName: nullopt,
      },
    },
    {
      name: "Earth",
      semiMajorAU: 1.000,
      semiMinorAU: 1.000,
      orbitRotationOffset: 1.796,
      orbitStartOffset: 0.8,
      important: true,
      render: {
        radiusAU: 0.37 * radiusScale,
        type: "sphere",
        periodD: 0.997,
        imageName: "assets/image/Blue_Marble_2002.png",
        nightImageName: opt("assets/image/BlackMarble_2016_01deg_gray.jpg"),
      },
    },
    {
      name: "Mars",
      semiMajorAU: 1.524,
      semiMinorAU: 1.517,
      orbitRotationOffset: 5.000,
      orbitStartOffset: 0.25,
      important: true,
      render: {
        radiusAU: 0.31 * radiusScale,
        type: "sphere",
        periodD: 1.026,
        imageName: "assets/image/Solarsystemscope_texture_8k_mars.jpg",
        nightImageName: nullopt,
      },
    },
    {
      name: "Ceres",
      semiMajorAU: 2.766,
      semiMinorAU: 2.757,
      orbitRotationOffset: 1.284,
      orbitStartOffset: 0.68,
      important: true,
      render: {
        radiusAU: 0.18 * radiusScale,
        type: "sphere",
        periodD: 0.378,
        imageName: "assets/image/Solarsystemscope_texture_4k_ceres_fictional.jpg",
        nightImageName: nullopt,
      },
    },
    {
      name: "Vesta",
      semiMajorAU: 2.362,
      semiMinorAU: 2.353,
      orbitRotationOffset: 2.647,
      orbitStartOffset: 0.2,
      important: false,
      render: {
        radiusAU: 0.15 * radiusScale,
        type: "sphere",
        periodD: 0.223,
        imageName: "assets/image/Vesta_map_for_GeoHack.png",
        nightImageName: nullopt,
      },
    },
    {
      name: "Tycho",
      semiMajorAU: 2.70,
      semiMinorAU: 2.631,
      orbitRotationOffset: 1.04,
      orbitStartOffset: 0.8,
      important: true,
      render: {
        radiusAU: 0.11 * radiusScale,
        type: "static",
        imageName: "assets/image/tycho.png",
      }
    },
    {
      name: "Eros",
      semiMajorAU: 1.458,
      semiMinorAU: 1.421,
      orbitRotationOffset: 3.121,
      orbitStartOffset: 0.55,
      important: true,
      render: {
        radiusAU: 0.15 * radiusScale,
        type: "sphere",
        periodD: 0.220,
        imageName: "assets/image/20150529_eros_map.jpg",
        nightImageName: nullopt,
      },
    },
    {
      name: "Thoth",
      semiMajorAU: 3.15,
      semiMinorAU: 3.14,
      orbitRotationOffset: 3.90,
      orbitStartOffset: 0.35,
      important: true,
      render: {
        radiusAU: 0.09 * radiusScale,
        type: "plate",
        periodD: 0.01,
        imageName: "assets/image/thoth.png",
      },
    },
    {
      name: "Jupiter",
      semiMajorAU: 5.203,
      semiMinorAU: 5.197,
      orbitRotationOffset: 4.787,
      orbitStartOffset: 0.15,
      important: true,
      render: {
        radiusAU: 0.67 * radiusScale,
        type: "sphere",
        periodD: 0.414,
        imageName: "assets/image/Solarsystemscope_texture_2k_jupiter.jpg",
        nightImageName: nullopt,
      },
    },
    {
      name: "Saturn",
      semiMajorAU: 9.537,
      semiMinorAU: 9.523,
      orbitRotationOffset: 5.915,
      orbitStartOffset: 0.03,
      important: true,
      render: {
        radiusAU: 0.57 * radiusScale,
        type: "sphere",
        periodD: 0.444,
        imageName: "assets/image/Solarsystemscope_texture_2k_saturn.jpg",
        nightImageName: nullopt,
      },
    },
  ];


type GameProps = {
  model: ExpanseModel_Sirius
};

function Game({ model }: GameProps) {
  const modelPlayer = React.useMemo<PlayerId>(() => getRandomInt(players.length), []);

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

  const [mcrWinProb, setMcrWinProb] = React.useState<number>(0.5);

  const [modelChoice, setModelChoice] = React.useState<Optional<{
    trace: {
      choice: GameStateContinuation,
      continuations: GameStateContinuations,
    }[],
    final: { choice: GameStateContinuation },
  }>>(nullopt);

  const continuationsInputs = getStateContinuationsInputs(gameState);
  const continuations = continuationsInputs.rootContinuations;
  const continuationsDecision = continuations.decision;

  const [turnHistory, setTurnHistory] = React.useState<TurnHistoryItem[]>([]);

  const maxHistoryLength = (NONSCORES_PER_PILE + SCORES_PER_PILE) * PILES;
  const [minDaysPerTurn, maxDaysPerTurn] = [5, 9];
  const startDate = new Date(
    new Date().getTime()
    + 300 * 365.25 * 24 * 60 * 60 * 1000
  );

  const drawTimesRef = React.useRef<Optional<{
    lastCheckpoint: {
      drawTimeMs: number,
      date: Date,
    },
    currentTimeMs: number,
    currentDate: Date,
    targetCheckpoint: {
      drawTimeMs: number,
      date: Date,
    },
  }>>(nullopt);

  const [dateString, setDateString] = React.useState<Optional<string>>(nullopt);
  useAnimationFrame(() => {
    return {
      callback: (currentTimeMs) => {
        const newDrawTimes: (typeof drawTimesRef.current & { hasValue: true })["value"] = (() => {
          const drawTimes = drawTimesRef.current;
          if (drawTimes.hasValue === false) {
            return {
              lastCheckpoint: {
                drawTimeMs: currentTimeMs - 1,
                date: new Date(startDate.getTime() - 1),
              },
              currentTimeMs,
              currentDate: startDate,
              targetCheckpoint: {
                drawTimeMs: currentTimeMs,
                date: startDate,
              }
            };
          } else {
            return {
              ...drawTimes.value,
              currentTimeMs,
              currentDate: new Date((() => {
                const transitionElapsed = unlerp(
                  drawTimes.value.lastCheckpoint.drawTimeMs,
                  drawTimes.value.targetCheckpoint.drawTimeMs,
                  currentTimeMs
                );

                const idleSpeed = (
                  3 * 60 * 1000 // 3 minutes
                  / (1000) // per second
                ) * (
                    (drawTimes.value.targetCheckpoint.drawTimeMs - drawTimes.value.lastCheckpoint.drawTimeMs)
                    / (drawTimes.value.targetCheckpoint.date.getTime() - drawTimes.value.lastCheckpoint.date.getTime())
                  );

                return lerp(
                  drawTimes.value.lastCheckpoint.date.getTime(),
                  drawTimes.value.targetCheckpoint.date.getTime(),
                  transitionElapsed < 0.5
                    ? transitionElapsed * (2 * (1 - idleSpeed) * transitionElapsed + idleSpeed)
                    : transitionElapsed < 1.0
                      ? (transitionElapsed - 1) * (-2 * (1 - idleSpeed) * (transitionElapsed - 1) + idleSpeed) + 1
                      : 1 + (transitionElapsed - 1) * idleSpeed
                );
              })()),
            };
          }
        })();
        if (!drawTimesRef.current.hasValue || drawTimesRef.current.value.currentDate.getDate() != newDrawTimes.currentDate.getDate()) {
          setDateString(opt(newDrawTimes.currentDate.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })));
        }

        drawTimesRef.current = opt(newDrawTimes);
      },
      cleanup: () => { },
    };
  }, []);

  const bodies = useLazyRef(() =>
    bodyMeta.map((meta, iBody) => ({
      meta,

      image: (() => {
        const image = new Image();
        image.src = meta.render.imageName;
        image.onload = () => {
          console.log(`Loaded ${meta.render.imageName}`);
          if (bodies.current.hasValue === false) throw `image load before bodies init finishes`;
          bodies.current = opt(bodies.current.value.withMap(iBody, b => ({
            ...b,
            image: {
              ...b.image,
              loaded: true,
            },
          })));
        }
        return ({
          image,
          loaded: false,
        });
      })(),

      nightImage: (() => {
        if (!(
          meta.render.type === "sphere"
          && meta.render.nightImageName.hasValue
        )) return nullopt;
        const src = meta.render.nightImageName.value;
        const image = new Image();
        image.src = src;
        image.onload = () => {
          console.log(`Loaded ${src}`);
          if (bodies.current.hasValue === false) throw `image load before bodies init finishes`;
          bodies.current = opt(bodies.current.value.withMap(iBody, b => ({
            ...b,
            nightImage: opt({
              image,
              loaded: true,
            }),
          })));
        }
        return opt({
          image,
          loaded: false,
        });
      })(),
    }))
  );

  function setGameState(continuation: GameStateContinuation) {
    if (drawTimesRef.current.hasValue && continuation.turnsComplete.length > 0) {
      drawTimesRef.current = opt({
        ...drawTimesRef.current.value,
        lastCheckpoint: {
          drawTimeMs: drawTimesRef.current.value.currentTimeMs,
          date: drawTimesRef.current.value.currentDate,
        },
        targetCheckpoint: {
          drawTimeMs: drawTimesRef.current.value.currentTimeMs + 1000 * 10,
          date: new Date(
            drawTimesRef.current.value.currentDate.getTime()
            + (
              (Math.random() * (maxDaysPerTurn - minDaysPerTurn) + minDaysPerTurn)
              * continuation.turnsComplete.length
              * 24 * 60 * 60 * 1000
            )
          ),
        },
      })
    }
    setTurnHistory(turnHistory.concat(continuation.turnsComplete));
    setGameStateRaw(continuation.state);
  }

  React.useEffect(() => {
    if (modelChoice.hasValue) {
      const timeout = setTimeout(() => {
        const traceHead = modelChoice.value.trace.get(0);
        if (traceHead.hasValue) {
          setGameState(traceHead.value.choice);
          setModelChoice(opt({
            ...modelChoice.value,
            trace: modelChoice.value.trace.slice(1),
          }));
        } else {
          setGameState(modelChoice.value.final.choice);
          setModelChoice(nullopt);
        }
      }, 4000 + getRandomInt(2000));
      return () => { clearTimeout(timeout); };
    }
    return;
  }, [modelChoice])

  React.useEffect(() => {
    const decision = continuations.decision;
    if (decision.hasValue === false) return () => { };

    const choices = continuationsInputs.choices.filterTransform(choice =>
      choice.final.hasValue
        ? opt({
          ...choice,
          final: choice.final.value
        })
        : nullopt
    );
    if (choices.length != continuationsInputs.choices.length) {
      if (decision.value.player === modelPlayer) {
        throw `untraceable continuation`;
      } else {
        console.error(`untraceable continuation -- continuing anyways since it is not model's turn`);
      }
      return;
    }

    model.inferModelStateMcrWinProbs(choices.map(c => c.final.input))
      .then(mcrWinProbs => {
        const bestWinProb =
          decision.value.player === 0
            ? Math.max(...mcrWinProbs)
            : Math.min(...mcrWinProbs);
        setMcrWinProb(bestWinProb);

        if (decision.value.player === modelPlayer) {
          const choice = mcrWinProbs.takeZip(choices).filterTransform(([mcrWinProb, choice]) => mcrWinProb == bestWinProb ? opt(choice) : nullopt).get(0);
          if (choice.hasValue === false) throw `no choice`;
          setModelChoice(choice);
        }
      });

    return () => { };

  }, [model, gameState]);

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
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div style={{
        width: "50dvmin",
        height: "100%",
        position: "relative",
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        maskImage: "linear-gradient(to right, white calc(100% - 0.5dvw), transparent 100%)",
      }}>
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
        <div // timeline content
          className="no-scrollbar"
          style={{
            width: "100%",
            height: "100%",
            boxSizing: "border-box",
            position: "relative",
            overflowY: "auto",
            maskImage: "linear-gradient(to bottom, white 95%, transparent 100%)",
          }}>
          {
            (() => {
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
                              border: "0.3dvw solid white",
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
                              borderTop: "0.3dvw solid white",
                              borderRight: "0.3dvw solid white",
                            }} />
                            {
                              historyItem.card.type === CardType.Score
                                ? <div style={{ fontSize: 32, width: 200 }}>Score (30)</div>
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
                              border: "0.3dvw solid white",
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
                              borderTop: "0.3dvw solid white",
                              borderRight: "0.3dvw solid white",
                            }} />
                            {
                              focus.value.type === CardType.Score
                                ? <div style={{ fontSize: 32, width: 200 }}>Score (30)</div>
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
                          backgroundColor: "rgba(255, 255, 255, 0.2)",
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
                              display: "flex",
                              justifyContent: "center",
                              alignContent: "center",
                            }}>
                            <motion.div // text (non-scaling)
                              layout="position"
                              transition={motionTransition}
                              style={{
                                alignContent: "center",
                              }}
                            >
                              {optValueOr(dateString, "")}
                            </motion.div>
                            <Canvas
                              layout
                              transition={motionTransition}
                              style={{
                                marginLeft: "0.5dvw",
                                height: "100%",
                                aspectRatio: 1,
                              }}

                              draw={React.useCallback((ctx) => {
                                const drawTimes = drawTimesRef.current;
                                if (drawTimes.hasValue === false) return;

                                const width = ctx.canvas.clientWidth;

                                ctx.clearRect(0, 0, width, width);

                                const clockRadius = width * 0.3

                                ctx.strokeStyle = '#bbbbbb';

                                ctx.beginPath();
                                ctx.arc(width / 2, width / 2, clockRadius, 0, Math.PI * 2);
                                ctx.stroke();
                                ctx.closePath();

                                const hourAngle = -Math.PI / 2 + Math.PI * 2 * (
                                  (
                                    (
                                      (drawTimes.value.currentDate.getHours() % 12)
                                      + (
                                        drawTimes.value.currentDate.getMinutes()
                                        + (
                                          + drawTimes.value.currentDate.getSeconds()
                                          + drawTimes.value.currentDate.getMilliseconds() / 1000
                                        ) / 60
                                      ) / 60
                                    ) / 12
                                  )
                                  % 1
                                );
                                const hourRadius = clockRadius * 0.5;
                                ctx.beginPath();
                                ctx.moveTo(width / 2, width / 2);
                                ctx.lineTo(width / 2 + Math.cos(hourAngle) * hourRadius, width / 2 + Math.sin(hourAngle) * hourRadius);
                                ctx.stroke();
                                ctx.closePath();

                                const minutesAngle = -Math.PI / 2 + Math.PI * 2 * (
                                  (
                                    (
                                      drawTimes.value.currentDate.getMinutes()
                                      + (
                                        + drawTimes.value.currentDate.getSeconds()
                                        + drawTimes.value.currentDate.getMilliseconds() / 1000
                                      ) / 60
                                    ) / 60
                                  )
                                  % 1
                                );
                                const minutesRadius = clockRadius * 0.8;
                                ctx.beginPath();
                                ctx.moveTo(width / 2, width / 2);
                                ctx.lineTo(width / 2 + Math.cos(minutesAngle) * minutesRadius, width / 2 + Math.sin(minutesAngle) * minutesRadius);
                                ctx.stroke();
                                ctx.closePath();
                              }, [])}
                            />
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
                            continuations.decision.hasValue
                            && (
                              continuations.decision.value.actions.clickUseAP.hasValue
                              || continuations.decision.value.actions.clickUseEvent.hasValue
                              || continuations.decision.value.actions.clickKeepEvent.hasValue
                              || continuations.decision.value.actions.clickPass.hasValue
                            )
                          )
                            ? "flex"
                            : "none"
                      }}>
                        {
                          [
                            { text: "Use AP", decision: optMap(continuations.decision, decision => ({ player: decision.player, continuation: decision.actions.clickUseAP })) },
                            { text: "Use Event", decision: optMap(continuations.decision, decision => ({ player: decision.player, continuation: decision.actions.clickUseEvent })) },
                            { text: "Keep Event", decision: optMap(continuations.decision, decision => ({ player: decision.player, continuation: decision.actions.clickKeepEvent })) },
                            { text: "Pass", decision: optMap(continuations.decision, decision => ({ player: decision.player, continuation: decision.actions.clickPass })) },
                          ]
                            .map(b =>
                              <button
                                key={b.text}
                                disabled={!(b.decision.hasValue && b.decision.value.continuation.hasValue)}
                                onClick={() => {
                                  if (b.decision.hasValue && b.decision.value.player != modelPlayer && b.decision.value.continuation.hasValue) {
                                    setGameState(b.decision.value.continuation.value);
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
                                      continuations.decision.hasValue === false
                                      || continuations.decision.value.actions.clickKeptCard[player.id]?.some(c => c.hasValue) === true
                                    )
                                      ? {
                                        maxHeight: `calc(${trackHeight} * 1.25)`,
                                        marginBottom: "1dvw",
                                        maskImage: "linear-gradient(to bottom, white 80%, transparent 100%)",
                                      }
                                      : {
                                        maxHeight: `calc(${trackHeight} * 0.25)`,
                                        marginBottom: 0,
                                        maskImage: "linear-gradient(to bottom, white 0%, transparent 100%)",
                                      }
                                ),
                                gridArea: "keptList",
                                overflowY:
                                  (
                                    continuations.decision.hasValue === false
                                    || continuations.decision.value.actions.clickKeptCard[player.id]?.some(c => c.hasValue) === true
                                  )
                                    ? "scroll"
                                    : "clip",
                              }}>
                              {
                                gameState.board.kept[player.id]
                                  .takeZip(
                                    (
                                      continuationsDecision.hasValue === false
                                        ? []
                                        : (continuationsDecision.value.actions.clickKeptCard[player.id] ?? []).map(cOpt => optMap(cOpt, continuation => ({
                                          player: continuationsDecision.value.player,
                                          continuation
                                        })))
                                    )
                                      .padRight({ toLength: gameState.board.kept[player.id].length, getPadElement: () => nullopt })
                                  )
                                  .map(([event, decision]) =>
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
                                          border: "0.3dvw solid white",
                                        }}
                                        onClick={() => {
                                          if (decision.hasValue && decision.value.player != modelPlayer) {
                                            setGameState(decision.value.continuation);
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
                      .takeZip(
                        continuationsDecision.hasValue
                          ? continuationsDecision.value.actions.clickTrackCard.map(cOpt => optMap(cOpt, continuation => ({
                            player: continuationsDecision.value.player,
                            continuation
                          })))
                          : gameState.board.cardTrack.map(() => nullopt)
                      )
                      .map(([card, decision], iTrack) => {
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
                                border: "0.3dvw solid white",
                              }}
                              onClick={() => {
                                if (decision.hasValue && decision.value.player != modelPlayer) {
                                  setGameState(decision.value.continuation);
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
                                borderTop: "0.3dvw solid white",
                                borderRight: "0.3dvw solid white",
                              }} />
                              { // content
                                card.type === CardType.Score
                                  ? <div style={{ fontSize: 32, width: 200 }}>Score (30)</div>
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
      <div style={{ flexGrow: 1, height: "100%", position: "relative" }}>
        <Canvas // map
          style={{
            position: "absolute",
            width: "200%",
            height: "100dvh",
            left: "-100%",
            zIndex: -1,
            display: "block",
          }}

          draw={React.useCallback((ctx) => {
            if (
              drawTimesRef.current.hasValue === false
              || bodies.current.hasValue === false
            ) return;

            const currentSimTimeD = (drawTimesRef.current.value.currentDate.getTime() - startDate.getTime()) / 24 / 60 / 60 / 1000;

            const width = ctx.canvas.clientWidth;
            const height = ctx.canvas.clientHeight;
            const sunX = width * 0.60;
            const sunY = height * 0.5;

            const systemRadiusAU = 15.5;
            const systemRotation = 0.2;
            const scalePower = 0.63;

            ctx.clearRect(0, 0, width, height);

            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, width, height);

            const sunRadius = 0.9 * radiusScale / systemRadiusAU * width / 2;
            ctx.ellipse(sunX, sunY, sunRadius, sunRadius, 0, 0, Math.PI * 2);
            ctx.fillStyle = '#ffff00';
            ctx.fill();

            bodies.current.value.forEach(body => {
              const semiMajor = Math.pow(body.meta.semiMajorAU / systemRadiusAU, scalePower) * width / 2;
              const semiMinor = Math.pow(body.meta.semiMinorAU / systemRadiusAU, scalePower) * width / 2;
              const centerOffset = -Math.sqrt(semiMajor * semiMajor - semiMinor * semiMinor);
              const eccentricity = Math.sqrt(1 - semiMinor * semiMinor / semiMajor / semiMajor);
              let rotation = body.meta.orbitRotationOffset + systemRotation;

              ctx.beginPath();
              ctx.ellipse(
                sunX + centerOffset * Math.cos(rotation),
                sunY + centerOffset * Math.sin(rotation),
                Math.pow(body.meta.semiMajorAU / systemRadiusAU, scalePower) * width / 2,
                Math.pow(body.meta.semiMinorAU / systemRadiusAU, scalePower) * width / 2,
                rotation,
                0,
                Math.PI * 2);
              ctx.strokeStyle = body.meta.important ? '#dddddd' : '#181818';
              ctx.stroke();
              ctx.closePath();

              const orbitalPeriodD = Math.pow(body.meta.semiMajorAU, 1.5) * 365.26;
              const orbitT = currentSimTimeD / orbitalPeriodD + body.meta.orbitStartOffset;
              const meanAnomaly = Math.PI * 2 * orbitT;
              // newton's method
              const eccentricAnomaly = Array(3).fill(false).reduce((lastEstimation) =>
                lastEstimation - (
                  (
                    lastEstimation
                    - eccentricity * Math.sin(lastEstimation)
                    - meanAnomaly
                  ) / (
                    1
                    - eccentricity * Math.cos(lastEstimation)
                  )
                ),
                meanAnomaly
              );
              let x = semiMajor * Math.cos(eccentricAnomaly);
              let y = semiMinor * Math.sin(eccentricAnomaly);
              let r = Math.sqrt(x * x + y * y)
              let theta = Math.atan2(y, x);
              theta += rotation;
              theta += Math.PI * 10;
              theta %= Math.PI * 2;
              x = r * Math.cos(theta);
              y = r * Math.sin(theta);
              x += centerOffset * Math.cos(rotation);
              y += centerOffset * Math.sin(rotation);
              x += sunX
              y += sunY

              const image = body.image;
              const nightImage = body.nightImage;
              if (image.loaded === false || (nightImage.hasValue && nightImage.value.loaded === false)) return;

              const radius = body.meta.render.radiusAU / systemRadiusAU * width / 2;
              if (body.meta.render.type === "sphere") {
                const width = image.image.naturalWidth * radius / image.image.naturalHeight * 2;
                const slideX = width * ((currentSimTimeD / Math.abs(body.meta.render.periodD)) % 1.0);
                const slideSign = body.meta.render.periodD > 0 ? -1 : 1;
                ctx.save();
                ctx.beginPath();
                ctx.arc(x, y, radius * 0.95, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(image.image, x - radius - slideSign * slideX, y - radius, width, radius * 2);
                ctx.drawImage(image.image, x - radius + slideSign * (width - slideX), y - radius, width, radius * 2);
                ctx.restore()

                ctx.save()
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.clip();

                const maskX = radius * (x - sunX) / Math.sign(y - sunY) / Math.max(0.01, Math.abs(y - sunY));

                const gradientRadius = Math.sqrt(maskX * maskX + radius * radius);
                const gradient = ctx.createRadialGradient(
                  x + maskX, y, 0,
                  x + maskX, y, gradientRadius * 2
                );

                const darknessOpacity = nightImage.hasValue ? 1.0 : 0.98;
                if (y > sunY) {
                  gradient.addColorStop(0, `rgba(0, 0, 0, ${darknessOpacity})`);
                  gradient.addColorStop(0.5 - 0.05 * radius / gradientRadius, `rgba(0, 0, 0, ${darknessOpacity})`);
                  gradient.addColorStop(0.5 + 0.1 * radius / gradientRadius, 'rgba(0, 0, 0, 0.0)');
                } else {
                  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.0)');
                  gradient.addColorStop(0.5 - 0.1 * radius / gradientRadius, 'rgba(0, 0, 0, 0.0)');
                  gradient.addColorStop(0.5 + 0.05 * radius / gradientRadius, `rgba(0, 0, 0, ${darknessOpacity})`);
                }

                ctx.globalCompositeOperation = 'destination-out';

                ctx.fillStyle = gradient;
                ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);

                if (nightImage.hasValue) {
                  ctx.globalCompositeOperation = 'destination-over';
                  ctx.drawImage(nightImage.value.image, x - radius - slideSign * slideX, y - radius, width, radius * 2);
                  ctx.drawImage(nightImage.value.image, x - radius + slideSign * (width - slideX), y - radius, width, radius * 2);
                }

                ctx.restore();
              }
              else if (body.meta.render.type === "plate") {
                const rotate = Math.PI * 2 * ((currentSimTimeD / Math.abs(body.meta.render.periodD)) % 1.0);
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(rotate);
                ctx.drawImage(image.image, -radius, -radius, radius * 2, radius * 2);
                ctx.restore();
              }
              else {
                assertType<"static">(body.meta.render.type);
                ctx.drawImage(image.image, x - radius, y - radius, radius * 2, radius * 2);
              }
            });
          }, [])}
        />
        <div style={{ width: "100%", height: "100%", textAlign: "center", alignContent: "center" }}>
          <div style={{ // win prob bar
            margin: "0.3dvh",
            width: "50%",
            height: "1dvw",
            position: "relative",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "blue",
            border: "0.1dvh solid white",
            textAlign: "left",
          }}>
            <div style={{
              backgroundColor: "red",
              width: `${mcrWinProb * 100}%`,
              height: "100%",
              transition: "width 1.4s ease-in-out",
            }} />
          </div>
          <div // instructions banner
          >
            <span style={{ fontSize: 20 }}>{continuations.instructions}</span>
            {
              (
                continuations.decision.hasValue
                && continuations.decision.value.player === modelPlayer
              )
                ? <span style={{ fontSize: 12 }}>
                  &nbsp;(model thinking<AnimatedEllipses />)
                </span>
                : undefined
            }
          </div>
          <div // board
          >
            <table style={{ display: "inline-block", verticalAlign: "top" }}><tbody>
              <tr>
                {
                  throwOnNullopt(
                    sectors.zip(
                      continuationsDecision.hasValue
                        ? continuationsDecision.value.actions.clickSector.map(cOpt => optMap(cOpt, continuation => ({
                          player: continuationsDecision.value.player,
                          continuation
                        })))
                        : sectors.map(() => nullopt),
                    ),
                    "bad continuations"
                  ).map(([s, decision]) => {
                    const bonusStatus: "not bonus" | "revealed bonus" | "masked bonus" = (() => {
                      if (!(
                        gameState.phase.phase === "score turn kept event deciding"
                        || gameState.phase.phase === "score turn kept event"
                      )) return "not bonus";
                      if (gameState.phase.bonusSector != s.id) return "not bonus";
                      const action =
                        gameState.phase.phase === "score turn kept event deciding"
                          ? gameState.phase.action
                          : gameState.phase.focus === EventId.Assassin
                            ? gameState.phase.assassinAction
                            : gameState.phase.action;
                      if (action === gameState.phase.turn) return "revealed bonus";
                      if (
                        gameState.phase.phase === "score turn kept event"
                        && gameState.phase.focus === EventId.Cotyar
                      ) return "revealed bonus";
                      return "masked bonus";
                    })();

                    return <td
                      key={s.id}
                      style={{ fontSize: 32, border: "thick solid gray" }}
                      colSpan={orbitals.filter(o => bands[o.band]?.sector == s.id).length}
                      onClick={() => {
                        if (decision.hasValue && decision.value.player != modelPlayer) {
                          setGameState(decision.value.continuation);
                        }
                      }}
                    >
                      {["  ", "⠂ ", "⠒ "][gameState.board.bonusSectorsRemaining[s.id] - (bonusStatus === "revealed bonus" ? 1 : 0)]}
                      {s.name}
                      {bonusStatus === "revealed bonus" ? "⭐" : "  "}
                    </td>;
                  })
                }
              </tr>
              <tr>
                {
                  throwOnNullopt(
                    orbitals.zip(
                      continuationsDecision.hasValue
                        ? continuationsDecision.value.actions.clickOrbital.map(cOpt => optMap(cOpt, continuation => ({
                          player: continuationsDecision.value.player,
                          continuation
                        })))
                        : orbitals.map(() => nullopt),
                    ),
                    "bad continuations"
                  ).map(([o, decision]) =>
                    <td
                      key={o.id}
                      style={{ fontSize: 24, border: "thick solid gray" }}
                      onClick={() => {
                        if (decision.hasValue && decision.value.player != modelPlayer) {
                          setGameState(decision.value.continuation);
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
                  (
                    continuationsDecision.hasValue
                      ? (
                        gameState.board.fleets
                          .takeZip(continuationsDecision.value.actions.clickOrbital.map(cOpt => optMap(cOpt, continuation => ({
                            player: continuationsDecision.value.player,
                            continuation
                          }))))
                          .takeZip(continuationsDecision.value.actions.clickFleet.map(oConts => oConts.map(pConts => pConts.map(fCont => optMap(fCont, continuation => ({
                            player: continuationsDecision.value.player,
                            continuation
                          }))))))
                      )
                      : gameState.board.fleets.map(oFleets => tuple2([
                        tuple2([oFleets, nullopt]),
                        [[], []],
                      ]))
                  )
                    .map(([[oFleets, orbitalDecision], orbitalFleetDecisions], orbital) =>
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
                          if (orbitalDecision.hasValue && orbitalDecision.value.player != modelPlayer) {
                            setGameState(orbitalDecision.value.continuation);
                          }
                        }}
                      >
                        {
                          players.takeZip(
                            continuationsDecision.hasValue
                              ? continuationsDecision.value.actions.clickBuildFleet.map(cOpt => optMap(cOpt, continuation => ({
                                player: continuationsDecision.value.player,
                                continuation
                              })))
                              : players.map(() => nullopt)
                          ).map(([player, buildDecision]) =>
                            <span key={player.id}>
                              {
                                (orbitalFleetDecisions[player.id] ?? []).padRight({ toLength: oFleets[player.id], getPadElement: () => nullopt })
                                  .map((fleetDecision, iFleet) =>
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
                                        if (fleetDecision.hasValue && fleetDecision.value.player != modelPlayer) {
                                          setGameState(fleetDecision.value.continuation);
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
                                    style={{ display: buildDecision.hasValue ? "inline" : "none" }}
                                    onClick={() => {
                                      if (buildDecision.hasValue && buildDecision.value.player != modelPlayer) {
                                        setGameState(buildDecision.value.continuation);
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
                          if (
                            base === undefined
                            || fleets === undefined
                            || influence === undefined
                          ) return <td key={iCol} />;

                          const orbitalControlBonus = map2(players, p => fleets[p.id] > fleets[p.opposite] && influence[p.id] != 0 ? 1 : 0);
                          const power = map2(orbitalControlBonus, (bonus, p) => influence[p] + bonus);

                          const baseDecision = optMap(continuationsDecision, decision => ({
                            player: decision.player,
                            continuation: decision.actions.clickBase[b.value] ?? nullopt,
                          }));
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
                              if (baseDecision.hasValue && baseDecision.value.player != modelPlayer && baseDecision.value.continuation.hasValue) {
                                setGameState(baseDecision.value.continuation.value);
                              }
                            }}
                          >
                            <div style={{ fontSize: 16 }}>{base.name}</div>
                            <div>
                              {
                                players.map(player =>
                                  <span key={player.id}>
                                    {
                                      (
                                        continuationsDecision.hasValue
                                          ? continuationsDecision.value.actions.clickInfluence[b.value]?.[player.id]?.map(cOpt => optMap(cOpt, continuation => ({
                                            player: continuationsDecision.value.player,
                                            continuation
                                          }))) ?? []
                                          : []
                                      )
                                        .padRight({ toLength: influence[player.id], getPadElement: () => nullopt })
                                        .map((influenceDecision, iInfluence) =>
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
                                              if (influenceDecision.hasValue && influenceDecision.value.player != modelPlayer) {
                                                setGameState(influenceDecision.value.continuation);
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
      </div>
    </div >
  );
}