"""Bake whole-drawing walking in-betweens without crossfading silhouettes.

This is an offline asset tool. The browser only loads the resulting PNG frames.
Install its dependencies from scripts/walking-requirements.txt.
"""

import json
from pathlib import Path
import sys

try:
    import cv2
    import numpy as np
except ImportError as error:
    raise SystemExit(
        "Walking asset rebuild needs: python3 -m pip install -r scripts/walking-requirements.txt"
    ) from error


def motion_guide(image):
    gray = cv2.cvtColor(image[:, :, :3], cv2.COLOR_BGR2GRAY)
    return np.uint8(gray.astype(np.float32) * image[:, :, 3] / 255)


def estimate_motion(before, after):
    estimator = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    estimator.setFinestScale(0)
    estimator.setPatchSize(8)
    estimator.setPatchStride(3)
    estimator.setGradientDescentIterations(32)
    estimator.setVariationalRefinementIterations(10)
    flow = estimator.calc(motion_guide(before), motion_guide(after), None)

    # Continue the foreground's motion into transparent space. A stationary
    # background field would pinch or tear a limb as its contour moves over it.
    opaque = before[:, :, 3] >= 200
    if not np.any(opaque):
        raise ValueError("A source pose has no opaque figure")
    _, labels = cv2.distanceTransformWithLabels(
        np.uint8(~opaque), cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL
    )
    foreground_motion = np.zeros((int(labels.max()) + 1, 2), np.float32)
    foreground_motion[labels[opaque]] = flow[opaque]
    flow[~opaque] = foreground_motion[labels[~opaque]]
    return cv2.GaussianBlur(flow, (0, 0), 3)


def warp_drawing(image, flow, fraction, grid):
    if fraction < 1e-8:
        return image.copy()
    # Integrate the inverse motion in small steps. Directly inverting a large
    # displacement can fold the sampling map and leave duplicate or broken edges.
    coordinates = grid.copy()
    steps = 24
    for _ in range(steps):
        motion = cv2.remap(
            flow, coordinates[:, :, 0], coordinates[:, :, 1],
            cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE,
        )
        coordinates -= fraction / steps * motion

    alpha = image[:, :, 3:4].astype(np.float32) / 255
    premultiplied = np.concatenate(
        (image[:, :, :3].astype(np.float32) * alpha, alpha * 255), axis=2
    )
    warped = cv2.remap(
        premultiplied, coordinates[:, :, 0], coordinates[:, :, 1],
        cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT,
    )
    warped[:, :, :3] *= 255 / np.maximum(warped[:, :, 3:4], 1)
    return np.uint8(np.clip(warped, 0, 255))


def move_landmarks(landmarks, flow, fraction):
    # Follow the same drawing's pixels. Linearly mixing the two endpoints' shoe
    # markers can put a marker in empty space when a leg becomes occluded.
    names = list(landmarks)
    points = np.array([[[landmarks[name]["x"], landmarks[name]["y"]] for name in names]], np.float32)
    for _ in range(24):
        motion = cv2.remap(
            flow, points[:, :, 0], points[:, :, 1],
            cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE,
        )
        points += fraction / 24 * motion
    return {name: {"x": float(points[0, i, 0]), "y": float(points[0, i, 1])} for i, name in enumerate(names)}


def main():
    if len(sys.argv) != 4:
        raise SystemExit("Usage: interpolate-walking.py poses.png timing.json output.rgba")
    image_path, timing_path, output_path = map(Path, sys.argv[1:])
    timing = json.loads(timing_path.read_text())
    cell, columns = timing["cell"], timing["columns"]
    selected, count = timing["selected"], timing["frames"]
    sheet = cv2.imread(str(image_path), cv2.IMREAD_UNCHANGED)
    if sheet is None or sheet.ndim != 3 or sheet.shape[2] != 4:
        raise ValueError("Source sheet must be an RGBA PNG")
    if selected[0]["phase"] != 0 or any(
        not 0 <= pose["phase"] < 1 or (i and pose["phase"] <= selected[i - 1]["phase"])
        for i, pose in enumerate(selected)
    ):
        raise ValueError("Source phases must increase strictly from zero")
    drawings = []
    for pose in selected:
        x, y = pose["index"] % columns * cell, pose["index"] // columns * cell
        drawing = sheet[y:y + cell, x:x + cell].copy()
        if drawing.shape != (cell, cell, 4):
            raise ValueError("Source pose falls outside the sheet")
        drawings.append(drawing)

    # Limit worker count for predictable offline builds on small cloud machines.
    cv2.setNumThreads(2)
    y, x = np.mgrid[:cell, :cell].astype(np.float32)
    grid = np.dstack((x, y))
    flows = {}
    landmarks = []
    sequence = []
    with output_path.open("wb") as output:
        for frame in range(count):
            phase = frame / count
            before = max(i for i, pose in enumerate(selected) if pose["phase"] <= phase)
            after = (before + 1) % len(selected)
            end = selected[after]["phase"] if after else 1
            fraction = (phase - selected[before]["phase"]) / (end - selected[before]["phase"])
            if abs(fraction - .5) < 1e-7:
                fraction = .5
            # Always sample one illustration, including its alpha. The closest
            # endpoint needs less deformation and keeps occluded limbs solid.
            start, finish = (before, after) if fraction <= .5 else (after, before)
            amount = min(fraction, 1 - fraction)
            sequence.append({"from": selected[before]["index"], "to": selected[after]["index"],
                             "progress": fraction, "drawing": selected[start]["index"], "warp": amount})
            if amount < 1e-8:
                drawing = drawings[start]
                landmarks.append(selected[start]["landmarks"])
            else:
                if (start, finish) not in flows:
                    flows[start, finish] = estimate_motion(drawings[start], drawings[finish])
                drawing = warp_drawing(drawings[start], flows[start, finish], amount, grid)
                landmarks.append(move_landmarks(selected[start]["landmarks"], flows[start, finish], amount))
            output.write(drawing[:, :, [2, 1, 0, 3]].tobytes())  # BGRA → RGBA
    output_path.with_suffix(".json").write_text(json.dumps({"landmarks": landmarks, "sequence": sequence}))


if __name__ == "__main__":
    main()
