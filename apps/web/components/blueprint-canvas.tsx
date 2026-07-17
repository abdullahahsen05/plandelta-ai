"use client";

import Konva from "konva";
import { useEffect, useMemo, useRef, useState } from "react";
import { Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text } from "react-konva";

import { changeKindMeta, type SampleChange } from "../lib/sample-data";

export type CompareMode = "overlay" | "split" | "swipe" | "blink" | "baseline" | "candidate";

type CanvasSize = { width: number; height: number };

const planWidth = 1000;
const planHeight = 700;

function useBlueprintImage(source?: string) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!source) {
      return;
    }
    const nextImage = new window.Image();
    nextImage.decoding = "async";
    nextImage.onload = () => setImage(nextImage);
    nextImage.src = source;
    return () => {
      nextImage.onload = null;
    };
  }, [source]);
  return image;
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
  baselineImageUrl,
  candidateImageUrl,
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
  baselineImageUrl?: string | undefined;
  candidateImageUrl?: string | undefined;
  documentWidth?: number | undefined;
  documentHeight?: number | undefined;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState<CanvasSize>({ width: 960, height: 640 });
  const [blinkVisible, setBlinkVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const baselineImage = useBlueprintImage(baselineImageUrl);
  const candidateImage = useBlueprintImage(candidateImageUrl);
  const usesArtifacts = Boolean(baselineImageUrl && candidateImageUrl);

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
  const showBaseline = mode !== "candidate";
  const showCandidate = mode !== "baseline" && (mode !== "blink" || reducedMotion || blinkVisible);
  const candidateClip =
    mode === "split"
      ? { x: documentWidth / 2, y: 0, width: documentWidth / 2, height: documentHeight }
      : mode === "swipe"
        ? { x: 0, y: 0, width: documentWidth * (swipe / 100), height: documentHeight }
        : { x: 0, y: 0, width: documentWidth, height: documentHeight };

  return (
    <div
      aria-label="Interactive blueprint comparison. Pan by dragging and use the toolbar to zoom or change comparison mode."
      className="blueprint-canvas-host"
      ref={hostRef}
      role="img"
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
          <Rect fill="#10263B" height={size.height} width={size.width} />
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
            {usesArtifacts && showBaseline && baselineImage ? (
              <KonvaImage
                height={documentHeight}
                image={baselineImage}
                opacity={mode === "overlay" ? 0.62 : 1}
                width={documentWidth}
              />
            ) : showBaseline ? (
              <BlueprintDrawing
                labels="baseline"
                lines={baselineLines}
                opacity={mode === "overlay" ? 0.58 : 0.9}
                stroke="#8EA8B9"
              />
            ) : null}
            {usesArtifacts && showCandidate && candidateImage ? (
              <Group clip={candidateClip}>
                <KonvaImage
                  height={documentHeight}
                  image={candidateImage}
                  opacity={mode === "overlay" ? opacity / 100 : 1}
                  width={documentWidth}
                />
              </Group>
            ) : showCandidate ? (
              <Group clip={candidateClip}>
                <BlueprintDrawing
                  labels="candidate"
                  lines={candidateLines}
                  opacity={opacity / 100}
                  stroke="#F2F5F3"
                />
              </Group>
            ) : null}
            {mode !== "baseline"
              ? changes.map((change) => {
                  const meta = changeKindMeta[change.kind];
                  const selected = change.id === selectedId;
                  return (
                    <Group key={change.id}>
                      <Rect
                        dash={
                          change.kind === "modified"
                            ? [13, 8]
                            : change.kind === "removed"
                              ? [4, 6]
                              : []
                        }
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
                })
              : null}
            {mode === "split" || mode === "swipe" ? (
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
        </Layer>
      </Stage>
      <span className="canvas-instruction">DRAG TO PAN · SCROLL TO ZOOM</span>
    </div>
  );
}
