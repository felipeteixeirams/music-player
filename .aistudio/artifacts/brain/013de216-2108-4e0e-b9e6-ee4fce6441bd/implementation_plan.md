# Implementation Plan - Audio-Driven Visualizer

Ensure the visualizer animates strictly when audio is actively playing, and displays flat/inactive state when paused or stopped.

## Proposed Changes

### Audio Context & Visualizer State (`src/context/AudioContext.tsx`)
- Update `audioFrequencyData` logic so that when `isPlaying` is false or `duration === 0` / audio is paused, all frequency bands drop immediately to zero (`0`), removing any false idle bouncing.
- Tie the frequency generator strictly to active audio playback progression.

## Verification Plan
- Verify via unit tests and visual check that pausing audio immediately flattens the frequency bars.
