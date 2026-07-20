"use client";

import Konva from "konva";
import { Maximize2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text } from "react-konva";

import { changeKindMeta, type SampleChange } from "../lib/sample-data";

export type CompareMode = "overlay" | "split" | "swipe" | "blink" | "baseline" | "candidate";

type CanvasSize = { width: number; height: number };
type BlueprintImageState = {
  image: HTMLImageElement | null;
  source?: string;
  status: "idle" | "loading" | "ready" | "error";
};

const planWidth = 1000;
const planHeight = 700;

function useBlueprintImage(source?: string) {
  const [state, setState] = useState<BlueprintImageState>({
    image: null,
    status: "idle",
  });

  useEffect(() => {
    if (!source) return;
    const nextImage = new window.Image();
    nextImage.decoding = "async";
    nextImage.onload = () => setState({ image: nextImage, source, status: "ready" });
    nextImage.onerror = () => setState({ image: null, source, status: "error" });
    nextImage.src = source;

    return () => {
      nextImage.onload = null;
      nextImage.onerror = null;
    };
  }, [source]);

  if (!source) return { image: null, status: "idle" } satisfies BlueprintImageState;
  if (state.source !== source) {
    return { image: null, source, status: "loading" } satisfies BlueprintImageState;
  }
  return state;
}

const baselineLines = [
  [90, 90, 910, 90, 910, 610, 90, 610, 90, 90],
  [90, 270, 390, 270, 390, 610],
  [390, 90, 390, 420, 910, 420],
  [640, 90, 640, 420],
  [730, 420, 730, 610],
  [510, 420, 510, 610],
  [180, 270, 180, 195, 290, 195, 290, 270],
  [640, 210, 725, 210, 725, 90],
  [800, 420, 800, 500, 910, 500],
];

const candidateLines = [
  ...baselineLines,
  [170, 245, 170, 160, 350, 160, 350, 270],
  [170, 245, 242, 245],
  [310, 245, 350, 245],
  [700, 420, 700, 480, 770, 480],
];

function BlueprintDrawing({
  lines,
  stroke,
  opacity,
  labels,
}: {
  lines: number[][];
  stroke: string;
  opacity: number;
  labels: "baseline" | "candidate";
}) {
  return (
    <Group opacity={opacity}>
      {lines.map((points, index) => (
        <Line
          key={`${labels}-${index}`}
          lineCap="square"
          lineJoin="miter"
          points={points}
          stroke={stroke}
          strokeWidth={2}
        />
      ))}
      <Text
        fill={stroke}
        fontFamily="monospace"
        fontSize={14}
        opacity={0.72}
        text="OPEN WORK 201"
        x={205}
        y={320}
      />
      <Text
        fill={stroke}
        fontFamily="monospace"
        fontSize={14}
        opacity={0.72}
        text="OFFICE 205"
        x={470}
        y={210}
      />
      <Text
        fill={stroke}
        fontFamily="monospace"
        fontSize={14}
        opacity={0.72}
        text="BREAK 206"
        x={755}
        y={530}
      />
      {labels === "candidate" ? (
        <Text
          fill={stroke}
          fontFamily="monospace"
          fontSize={14}
          opacity={0.9}
          text="CONFERENCE 204"
          x={185}
          y={184}
        />
      ) : null}
      <Text
        fill={stroke}
        fontFamily="monospace"
        fontSize={12}
        opacity={0.58}
        text="A2.14 · LEVEL 02 FLOOR PLAN"
        x={105}
        y={580}
      />
    </Group>
  );
}

function ChangeRegions({
  changes,
  selectedId,
  documentWidth,
  documentHeight,
  onSelect,
}: {
  changes: SampleChange[];
  selectedId: string;
  documentWidth: number;
  documentHeight: number;
  onSelect: (id: string) => void;
}) {
  return changes.map((change) => {
    const meta = changeKindMeta[change.kind];
    const selected = change.id === selectedId;

    return (
      <Group key={change.id}>
        <Rect
          dash={change.kind === "modified" ? [13, 8] : change.kind === "removed" ? [4, 6] : []}
          fill={selected ? `${meta.color}24` : "transparent"}
          height={change.box.height * documentHeight}
          onClick={() => onSelect(change.id)}
          onTap={() => onSelect(change.id)}
          stroke={meta.color}
          strokeWidth={selected ? 5 : 3}
          width={change.box.width * documentWidth}
          x={change.box.x * documentWidth}
          y={change.box.y * documentHeight}
        />
        <Rect
          fill={meta.color}
          height={24}
          width={40}
          x={change.box.x * documentWidth}
          y={change.box.y * documentHeight - 24}
        />
        <Text
          align="center"
          fill="#FFFFFF"
          fontFamily="monospace"
          fontSize={12}
          text={String(change.sequence).padStart(2, "0")}
          width={40}
          x={change.box.x * documentWidth}
          y={change.box.y * documentHeight - 18}
        />
      </Group>
    );
  });
}

export function BlueprintCanvas({
  changes,
  selectedId,
  mode,
  opacity,
  zoom,
  swipe,
  fitToken,
  onSelect,
  onZoomChange,
  onOpenLarge,
  baselineImageUrl,
  candidateImageUrl,
  alignedCandidateImageUrl,
  documentWidth = planWidth,
  documentHeight = planHeight,
}: {
  changes: SampleChange[];
  selectedId: string;
  mode: CompareMode;
  opacity: number;
  zoom: number;
  swipe: number;
  fitToken: number;
  onSelect: (id: string) => void;
  onZoomChange: (zoom: number) => void;
  onOpenLarge?: ((view: "split" | "baseline" | "candidate") => void) | undefined;
  baselineImageUrl?: string | undefined;
  candidateImageUrl?: string | undefined;
  alignedCandidateImageUrl?: string | undefined;
  documentWidth?: number | undefined;
  documentHeight?: number | undefined;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState<CanvasSize>({ width: 960, height: 640 });
  const [blinkVisible, setBlinkVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const baselineImageState = useBlueprintImage(baselineImageUrl);
  const candidateImageState = useBlueprintImage(candidateImageUrl);
  const alignedCandidateImageState = useBlueprintImage(
    alignedCandidateImageUrl ?? candidateImageUrl,
  );
  const usesArtifacts = Boolean(baselineImageUrl && candidateImageUrl);
  const isSideBySide = mode === "split";
  const activeCandidateImageState =
    isSideBySide || mode === "candidate" ? candidateImageState : alignedCandidateImageState;
  const imagesReady =
    !usesArtifacts ||
    (baselineImageState.status === "ready" && activeCandidateImageState.status === "ready");
  const imageLoadFailed =
    usesArtifacts &&
    (baselineImageState.status === "error" || activeCandidateImageState.status === "error");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const update = () => setSize({ width: host.clientWidth, height: host.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (mode !== "blink" || reducedMotion) return;

    const timer = window.setInterval(() => setBlinkVisible((visible) => !visible), 850);
    return () => window.clearInterval(timer);
  }, [mode, reducedMotion]);

  useEffect(() => {
    stageRef.current?.position({ x: 0, y: 0 });
    stageRef.current?.batchDraw();
  }, [fitToken, size]);

  const fitScale = useMemo(
    () => Math.min((size.width - 40) / documentWidth, (size.height - 40) / documentHeight),
    [documentHeight, documentWidth, size],
  );
  const drawingScale = fitScale * zoom;
  const drawingX = (size.width - documentWidth * drawingScale) / 2;
  const drawingY = (size.height - documentHeight * drawingScale) / 2;
  const comparisonGap = 18;
  const comparisonInset = 12;
  const comparisonLabelHeight = 42;
  const comparisonPanelWidth = Math.max(
    150,
    (size.width - comparisonInset * 2 - comparisonGap) / 2,
  );
  const comparisonPanelHeight = Math.max(320, size.height - comparisonInset * 2);
  const sideBySideScale =
    Math.min(
      (comparisonPanelWidth - 24) / documentWidth,
      (comparisonPanelHeight - comparisonLabelHeight - 18) / documentHeight,
    ) * zoom;
  const sideBySideY =
    comparisonInset +
    comparisonLabelHeight +
    (comparisonPanelHeight - comparisonLabelHeight - documentHeight * sideBySideScale) / 2;
  const baselineSideX =
    comparisonInset + (comparisonPanelWidth - documentWidth * sideBySideScale) / 2;
  const candidatePanelX = comparisonInset + comparisonPanelWidth + comparisonGap;
  const candidateSideX =
    candidatePanelX + (comparisonPanelWidth - documentWidth * sideBySideScale) / 2;
  const showBaseline = mode !== "candidate";
  const showCandidate = mode !== "baseline" && (mode !== "blink" || reducedMotion || blinkVisible);
  const candidateClip =
    mode === "swipe"
      ? { x: 0, y: 0, width: documentWidth * (swipe / 100), height: documentHeight }
      : { x: 0, y: 0, width: documentWidth, height: documentHeight };

  return (
    <div
      aria-label="Interactive blueprint comparison. The baseline is the earlier drawing and the candidate is the revised drawing."
      className="blueprint-canvas-host"
      data-preview-state={imageLoadFailed ? "error" : imagesReady ? "ready" : "loading"}
      ref={hostRef}
      role="group"
    >
      <Stage
        draggable
        height={size.height}
        onWheel={(event) => {
          event.evt.preventDefault();
          onZoomChange(Math.min(2.4, Math.max(0.65, zoom + (event.evt.deltaY > 0 ? -0.1 : 0.1))));
        }}
        ref={stageRef}
        width={size.width}
      >
        <Layer>
          <Rect
            fill={isSideBySide || usesArtifacts ? "#D9D7D0" : "#10263B"}
            height={size.height}
            width={size.width}
          />
          {isSideBySide ? (
            <>
              <Rect
                fill="#FFFFFF"
                height={comparisonPanelHeight}
                stroke="#AAA79F"
                width={comparisonPanelWidth}
                x={comparisonInset}
                y={comparisonInset}
              />
              <Rect
                fill="#FFFFFF"
                height={comparisonPanelHeight}
                stroke="#AAA79F"
                width={comparisonPanelWidth}
                x={candidatePanelX}
                y={comparisonInset}
              />
              <Text
                fill="#171A1C"
                fontFamily="sans-serif"
                fontSize={13}
                fontStyle="bold"
                text="BEFORE  ·  BASELINE"
                x={comparisonInset + 14}
                y={comparisonInset + 14}
              />
              <Text
                fill="#171A1C"
                fontFamily="sans-serif"
                fontSize={13}
                fontStyle="bold"
                text="REVISED  ·  CANDIDATE"
                x={candidatePanelX + 14}
                y={comparisonInset + 14}
              />
              <Group
                scaleX={sideBySideScale}
                scaleY={sideBySideScale}
                x={baselineSideX}
                y={sideBySideY}
              >
                {usesArtifacts && baselineImageState.image ? (
                  <KonvaImage
                    height={documentHeight}
                    image={baselineImageState.image}
                    width={documentWidth}
                  />
                ) : !usesArtifacts ? (
                  <BlueprintDrawing
                    labels="baseline"
                    lines={baselineLines}
                    opacity={0.92}
                    stroke="#263844"
                  />
                ) : null}
                {onOpenLarge ? (
                  <Rect
                    fill="rgba(255,255,255,0.001)"
                    height={documentHeight}
                    onClick={() => onOpenLarge("baseline")}
                    onTap={() => onOpenLarge("baseline")}
                    width={documentWidth}
                  />
                ) : null}
              </Group>
              <Group
                scaleX={sideBySideScale}
                scaleY={sideBySideScale}
                x={candidateSideX}
                y={sideBySideY}
              >
                {usesArtifacts && candidateImageState.image ? (
                  <KonvaImage
                    height={documentHeight}
                    image={candidateImageState.image}
                    width={documentWidth}
                  />
                ) : !usesArtifacts ? (
                  <BlueprintDrawing
                    labels="candidate"
                    lines={candidateLines}
                    opacity={0.92}
                    stroke="#263844"
                  />
                ) : null}
                {onOpenLarge ? (
                  <Rect
                    fill="rgba(255,255,255,0.001)"
                    height={documentHeight}
                    onClick={() => onOpenLarge("candidate")}
                    onTap={() => onOpenLarge("candidate")}
                    width={documentWidth}
                  />
                ) : null}
                <ChangeRegions
                  changes={changes}
                  documentHeight={documentHeight}
                  documentWidth={documentWidth}
                  onSelect={onSelect}
                  selectedId={selectedId}
                />
              </Group>
            </>
          ) : (
            <Group scaleX={drawingScale} scaleY={drawingScale} x={drawingX} y={drawingY}>
              {!usesArtifacts
                ? Array.from({ length: 36 }, (_, index) => (
                    <Line
                      key={`grid-v-${index}`}
                      opacity={index % 5 === 0 ? 0.09 : 0.035}
                      points={[index * 30, 0, index * 30, documentHeight]}
                      stroke="#FFFFFF"
                      strokeWidth={1 / drawingScale}
                    />
                  ))
                : null}
              {!usesArtifacts
                ? Array.from({ length: 25 }, (_, index) => (
                    <Line
                      key={`grid-h-${index}`}
                      opacity={index % 5 === 0 ? 0.09 : 0.035}
                      points={[0, index * 30, documentWidth, index * 30]}
                      stroke="#FFFFFF"
                      strokeWidth={1 / drawingScale}
                    />
                  ))
                : null}
              {usesArtifacts && showBaseline && baselineImageState.image ? (
                <KonvaImage
                  height={documentHeight}
                  image={baselineImageState.image}
                  opacity={mode === "overlay" ? 0.62 : 1}
                  width={documentWidth}
                />
              ) : !usesArtifacts && showBaseline ? (
                <BlueprintDrawing
                  labels="baseline"
                  lines={baselineLines}
                  opacity={mode === "overlay" ? 0.58 : 0.9}
                  stroke="#8EA8B9"
                />
              ) : null}
              {usesArtifacts && showCandidate && activeCandidateImageState.image ? (
                <Group clip={candidateClip}>
                  <KonvaImage
                    height={documentHeight}
                    image={activeCandidateImageState.image}
                    opacity={mode === "overlay" ? opacity / 100 : 1}
                    width={documentWidth}
                  />
                </Group>
              ) : !usesArtifacts && showCandidate ? (
                <Group clip={candidateClip}>
                  <BlueprintDrawing
                    labels="candidate"
                    lines={candidateLines}
                    opacity={opacity / 100}
                    stroke="#F2F5F3"
                  />
                </Group>
              ) : null}
              {onOpenLarge && (mode === "baseline" || mode === "candidate") ? (
                <Rect
                  fill="rgba(255,255,255,0.001)"
                  height={documentHeight}
                  onClick={() => onOpenLarge(mode)}
                  onTap={() => onOpenLarge(mode)}
                  width={documentWidth}
                />
              ) : null}
              {mode !== "baseline" ? (
                <ChangeRegions
                  changes={changes}
                  documentHeight={documentHeight}
                  documentWidth={documentWidth}
                  onSelect={onSelect}
                  selectedId={selectedId}
                />
              ) : null}
              {mode === "swipe" ? (
                <Line
                  points={[
                    candidateClip.x + candidateClip.width,
                    0,
                    candidateClip.x + candidateClip.width,
                    documentHeight,
                  ]}
                  stroke="#E6532F"
                  strokeWidth={3}
                />
              ) : null}
            </Group>
          )}
        </Layer>
      </Stage>
      {usesArtifacts && !imagesReady ? (
        <div
          className={imageLoadFailed ? "canvas-image-error" : "canvas-image-loading"}
          role="status"
        >
          <strong>
            {imageLoadFailed ? "Drawing preview unavailable" : "Loading your drawings…"}
          </strong>
          <span>
            {imageLoadFailed
              ? "The viewer did not substitute another drawing. Refresh to retry the secure preview."
              : "PlanDelta is opening the uploaded files."}
          </span>
        </div>
      ) : null}
      {onOpenLarge && imagesReady ? (
        <div className="drawing-open-actions" role="group" aria-label="Open drawings large">
          {isSideBySide ? (
            <>
              <button onClick={() => onOpenLarge("baseline")} type="button">
                <Maximize2 aria-hidden="true" size={14} /> Open before
              </button>
              <button onClick={() => onOpenLarge("candidate")} type="button">
                <Maximize2 aria-hidden="true" size={14} /> Open revised
              </button>
            </>
          ) : (
            <button
              onClick={() =>
                onOpenLarge(mode === "baseline" || mode === "candidate" ? mode : "split")
              }
              type="button"
            >
              <Maximize2 aria-hidden="true" size={14} /> Open large viewer
            </button>
          )}
        </div>
      ) : null}
      <span className="canvas-instruction">
        {isSideBySide
          ? "BEFORE ON LEFT  ·  REVISED ON RIGHT  ·  DRAG TO PAN"
          : "DRAG TO PAN  ·  SCROLL TO ZOOM"}
      </span>
    </div>
  );
}
